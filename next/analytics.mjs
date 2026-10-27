// Only bounded, reviewed parameters may reach GA. Never pass forms or route IDs.
const screens=new Set(['groups','group','group-create','trip-create','trip','legacy','create','join','room']);
const operations=new Set(['createGroup','createTrip','addTripPlace','createRoom','joinRoom','completeQuest','rotateInvite','closeRoom','submit']);
const errors=new Set(['invalid-argument','unauthenticated','permission-denied','not-found','already-exists','resource-exhausted','failed-precondition','unavailable','deadline-exceeded','internal']);
const noop=()=>{};
export const countBucket=n=>n===0?'0':n<=3?'1-3':n<=6?'4-6':n<=10?'7-10':'11+';
export const daysBucket=n=>n<=1?'1':n<=3?'2-3':n<=7?'4-7':'8+';
const countBuckets=new Set(['0','1-3','4-6','7-10','11+']);
function common(input){
  const out={app_version:'v2.0.0',schema_version:'1'};
  if(['leader','member'].includes(input.role))out.role=input.role;
  if(['draft','active','ended'].includes(input.trip_status))out.trip_status=input.trip_status;
  // Firestore auto IDs only; no URL tokens, user IDs, or user-chosen names.
  for(const key of ['group_id','trip_id'])if(/^[A-Za-z0-9]{20}$/.test(input[key]||''))out[key]=input[key];
  return out;
}
export async function createAnalytics({app,config,loadSdk,location,debug=false}) {
  const disabled={track:noop,setAuthType:noop};
  if(config.useEmulators || !/^G-[A-Z0-9]+$/.test(config.firebaseConfig?.measurementId||'') || config.enableAnalytics===false)return disabled;
  try {
    const sdk=await loadSdk();
    if(!await sdk.isSupported())return disabled;
    // Override URL/referrer/title before initialization, including automatic session events.
    const pageLocation=new URL('./',location).href;
    const analytics=sdk.initializeAnalytics(app,{config:{send_page_view:false,page_location:pageLocation,page_referrer:'',page_title:'OurAdventure',allow_google_signals:false,allow_ad_personalization_signals:false}});
    return {setAuthType(type){try{sdk.setUserProperties(analytics,{auth_type:['google','anonymous'].includes(type)?type:null});}catch{}},track(name,input={}) {
      let params;
      if(name==='page_view' && screens.has(input.screen_name))params={screen_name:input.screen_name,page_title:input.screen_name};
      else if(name==='screen_view' && ['map','course','stamps','memory','stamp_detail','report','share_image'].includes(input.screen_name))params={screen_name:input.screen_name};
      else if(name==='login' && input.method==='google')params={method:'google'};
      else if(name==='logout')params={};
      else if(name==='group_create' || name==='trip_create_start')params={};
      else if(name==='group_open' && countBuckets.has(input.trip_count))params={trip_count:input.trip_count};
      else if(name==='trip_create' && countBuckets.has(input.place_count) && ['1','2-3','4-7','8+'].includes(input.days))params={place_count:input.place_count,days:input.days,ai_used:false};
      else if(name==='past_trip_open' && ['0','1-7','8-30','31+','unknown'].includes(input.days_since_end_bucket))params={days_since_end_bucket:input.days_since_end_bucket};
      else if(name==='operation_error' && operations.has(input.operation)) {
        const code=String(input.error_code||'').replace(/^functions\//,'');
        params={operation:input.operation,error_code:errors.has(code)?code:'unknown'};
      } else return;
      try{sdk.logEvent(analytics,name,{...common(input),...params,page_location:pageLocation,page_referrer:'',...(debug?{debug_mode:true}:{})});}catch{/* Analytics must never block a trip. */}
    }};
  } catch {return disabled;}
}
