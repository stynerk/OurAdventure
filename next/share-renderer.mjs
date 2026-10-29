export const SHARE_FORMATS=Object.freeze({feed:{width:1080,height:1350},story:{width:1080,height:1920}});
export function imageLayout(config){
  const size=SHARE_FORMATS[config?.format];
  if(!size || config.version!==1 || config.width!==size.width || config.height!==size.height || !['grid','board'].includes(config.template) || !Array.isArray(config.photos) || config.photos.length<1 || config.photos.length>6 || new Set(config.photos.map(p=>p.id)).size!==config.photos.length)throw Error('사진을 1~6장 선택하고 미리보기를 다시 만들어주세요.');
  if(!Number.isInteger(config.placeCount) || config.placeCount<0 || config.placeCount>10 || !Array.isArray(config.members) || config.members.length<1 || config.members.length>10)throw Error('도장 정보를 확인하지 못했어요.');
  const {width,height}=size,margin=64,gap=24,top=236,available=width-margin*2,photos=[];
  const boardSpace=36+config.members.length*(config.format==='story'?88:64);
  const photoArea=config.template==='grid'?height-top-122:height-top-122-64-boardSpace,columns=config.template==='board' && config.members.length>6?3:2,rows=Math.ceil(config.photos.length/columns),tileHeight=(photoArea-gap*(rows-1))/rows;
  for(let row=0,index=0;row<rows;row++){
    const count=Math.min(columns,config.photos.length-index),w=(available-gap*(count-1))/count;
    for(let column=0;column<count;column++,index++)photos.push({id:config.photos[index].id,alias:config.photos[index].alias,x:margin+column*(w+gap),y:top+row*(tileHeight+gap),w,h:tileHeight,caption:config.template==='grid'?52:36});
  }
  const boardY=top+photoArea+64,boardBottom=height-104,rowHeight=Math.min(config.format==='story'?100:64,(boardBottom-boardY-36)/config.members.length);
  return {width,height,margin,photos,boardY,rowHeight,footerY:height-48};
}
function rounded(ctx,x,y,w,h,r=20){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function label(ctx,value,x,y,maxWidth){let text=String(value??'');while(text.length && ctx.measureText(text).width>maxWidth)text=text.slice(0,-1);if(text!==String(value??''))text=text.slice(0,-1)+'…';ctx.fillText(text,x,y);}
function cover(ctx,image,rect){
  const sourceW=image.naturalWidth||image.width,sourceH=image.naturalHeight||image.height;
  if(!sourceW || !sourceH)throw Error('사진을 불러오지 못했어요.');
  const h=rect.h-rect.caption,scale=Math.max(rect.w/sourceW,h/sourceH),sw=rect.w/scale,sh=h/scale;
  ctx.drawImage(image,(sourceW-sw)/2,(sourceH-sh)/2,sw,sh,rect.x,rect.y,rect.w,h);
}
export function renderShareImage(canvas,config,images){
  const layout=imageLayout(config);
  for(const photo of config.photos)if(!images.get(photo.id))throw Error('선택한 사진을 모두 불러와야 저장할 수 있어요.');
  canvas.width=layout.width;canvas.height=layout.height;const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('이 브라우저에서 이미지를 만들지 못했어요.');
  ctx.fillStyle='#f4f5f7';ctx.fillRect(0,0,layout.width,layout.height);
  ctx.fillStyle='#111827';ctx.font='bold 62px Pretendard, sans-serif';label(ctx,config.includeTripTitle===true?config.tripTitle:'Our Adventure',64,112,952);
  ctx.font='24px Pretendard, sans-serif';ctx.fillStyle='#626a79';ctx.fillText(config.template==='grid'?'함께 남긴 추억':'우리가 모은 도장',66,160);
  ctx.font='22px Pretendard, sans-serif';ctx.fillText(`사진 ${config.photos.length}장 · 도장 ${config.stampCount}/${config.stampTotal}`,66,202);
  for(const rect of layout.photos){
    ctx.save();rounded(ctx,rect.x,rect.y,rect.w,rect.h);ctx.clip();ctx.fillStyle='#ffffff';ctx.fillRect(rect.x,rect.y,rect.w,rect.h);cover(ctx,images.get(rect.id),rect);ctx.restore();
    ctx.fillStyle='#111827';ctx.font=`${config.template==='grid'?26:20}px Pretendard, sans-serif`;label(ctx,rect.alias,rect.x+16,rect.y+rect.h-15,rect.w-32);
  }
  if(config.template==='board'){
    const left=240,cell=(layout.width-64-left)/Math.max(config.placeCount,1);
    ctx.font='18px Pretendard, sans-serif';ctx.fillStyle='#626a79';
    for(let i=0;i<config.placeCount;i++){ctx.textAlign='center';ctx.fillText(String(i+1).padStart(2,'0'),left+cell*(i+.5),layout.boardY);}
    ctx.textAlign='left';
    config.members.forEach((member,index)=>{
      const cy=layout.boardY+30+layout.rowHeight*index+layout.rowHeight/2;
      ctx.fillStyle='#111827';ctx.font='22px Pretendard, sans-serif';label(ctx,member.alias,64,cy+7,160);
      if(!config.placeCount){ctx.font='20px Pretendard, sans-serif';ctx.fillText('0 / 0',left,cy+7);}
      for(let i=1;i<=config.placeCount;i++){
        const x=left+cell*(i-.5),done=member.stampIndices.includes(i),radius=Math.min(21,cell*.33,layout.rowHeight*.33);
        ctx.beginPath();ctx.arc(x,cy,radius,0,Math.PI*2);ctx.fillStyle=done?'#d63e1b':'#e9ecf1';ctx.fill();
        if(done){ctx.beginPath();ctx.moveTo(x-radius*.45,cy);ctx.lineTo(x-radius*.08,cy+radius*.35);ctx.lineTo(x+radius*.48,cy-radius*.38);ctx.lineWidth=3;ctx.strokeStyle='#ffffff';ctx.stroke();}
        else{ctx.font='16px Jua, sans-serif';ctx.fillStyle='#626a79';ctx.textAlign='center';ctx.fillText(String(i),x,cy+5);ctx.textAlign='left';}
      }
    });
  }
  ctx.fillStyle='#626a79';ctx.font='18px Pretendard, sans-serif';ctx.fillText('Our Adventure',64,layout.footerY);
  return layout;
}
export async function sharePng(canvas){
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob || !blob.size)throw Error('PNG를 만들지 못했어요. 다시 시도해주세요.');return blob;
}
