const MAX_STOPS=60;
const clean=(v,max=500)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max):'';
function normalizeStop(value,trip={}){
  const name=clean(value?.name,100);if(!name)throw Error('장소 이름을 입력해주세요.');
  const days=trip.startDate&&trip.endDate?Math.floor((Date.parse(trip.endDate)-Date.parse(trip.startDate))/86400000)+1:366;
  const day=value.day==null||value.day===''?null:Number(value.day);
  if(day!==null&&(!Number.isInteger(day)||day<1||day>Math.min(days,366)))throw Error('일차는 여행 기간 안에서 선택해주세요.');
  const time=v=>{if(!v)return '';if(typeof v!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Error('시간은 HH:MM 형식으로 입력해주세요.');return v;};
  const startTime=time(value.startTime),endTime=time(value.endTime);
  if(startTime&&endTime&&endTime<=startTime)throw Error('종료 시간은 시작 시간보다 늦어야 해요. 확인되지 않은 시간은 비워주세요.');
  return {name,day,startTime,endTime,note:clean(value.note),description:clean(value.description),sourceUrl:'',googlePlaceId:typeof value.googlePlaceId==='string'&&/^[A-Za-z0-9_-]{1,255}$/.test(value.googlePlaceId)?value.googlePlaceId:'',kind:value.kind==='note'?'note':'place',order:Number.isInteger(value.order)&&value.order>=0&&value.order<MAX_STOPS?value.order:0};
}
module.exports={MAX_STOPS,normalizeStop};
