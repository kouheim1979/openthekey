// Public campaign information only. Confirmation is a local calculation input, NOT claiming eligibility.
const COUPON_STATE={}; // Page-session only: never assume that a previously used campaign is still usable.
const COUPON_PROVIDERS={
 vpass:{label:'Vクーポン'},
 paypay:{label:'PayPay'},
 rakuten:{label:'楽天ペイ'},
 dpay:{label:'d払い'},
 aupay:{label:'au PAY'},
 aeonpay:{label:'AEON Pay'},
 famipay:{label:'FamiPay'}
};
let couponLoading=true,couponFailed=false,lastCouponContext=null;
function couponNorm(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/[\s　・･‐‑–—ー()（）-]/g,'');}
function couponPaymentProvider(p){
 const id=String(p&&p.id||''),n=String(p&&p.n||'');
 if(['paypay','paypayCoke','paypayReview','paypayPublicCoupon'].includes(id)||n==='PayPay')return'paypay';
 if(['rakuten','rakutenCard','rakutenReview'].includes(id)||n.startsWith('楽天ペイ'))return'rakuten';
 if(id==='dpay'||n==='d払い')return'dpay';
 if(id==='aupay'||n==='au PAY')return'aupay';
 if(['aeonpay','aeonGroup'].includes(id)||n==='AEON Pay')return'aeonpay';
 if(id==='famipay'||n==='FamiPay')return'famipay';
 if(id==='vpassCouponCard'||n==='Olive'||n==='Olive通常'||n.includes('三井住友カード'))return'vpass';
 return'';
}
function couponLive(o,now=Date.now()){
 const checked=Date.parse(o.checkedAt||COUPON_FEED.updatedAt||'');
 if(!Number.isFinite(checked)||now-checked>48*3600000||checked-now>3600000)return false;
 if(o.start&&now<Date.parse(o.start+'T00:00:00+09:00'))return false;
 if(o.end&&now>Date.parse(o.end+'T23:59:59+09:00'))return false;
 if(o.rankable===false)return Boolean(o.title||o.note||o.brand);
 const rate=Number(o.rate),fixed=Number(o.fixedBonus);
 return (Number.isFinite(rate)&&rate>0&&rate<=100)||(Number.isFinite(fixed)&&fixed>0);
}
function couponMatches(store,o){
 if(o.brand==='*')return true;
 const names=[store.store,...(store.aliases||[])].map(couponNorm);
 return [o.brand,...(o.aliases||[])].filter(Boolean).some(b=>names.includes(couponNorm(b)));
}
function couponOfferFitsPayment(o,p){
 return !p||!Array.isArray(o.paymentIds)||!o.paymentIds.length||o.paymentIds.includes(p.id);
}
function couponOffers(store,provider,payment=null){
 return (COUPON_FEED.offers||[]).filter(o=>o.provider===provider&&couponLive(o)&&couponMatches(store,o)&&couponOfferFitsPayment(o,payment));
}
function couponState(store){return COUPON_STATE[store.store]||(COUPON_STATE[store.store]={amount:0,checked:{}});}
function couponPoints(o,amount){
 if(!o.termsVerified||!o.start||!o.end||!Number.isFinite(amount)||amount<=0)return 0;
 if(o.minSpend!=null&&amount<Number(o.minSpend))return 0;
 let bonus=0;
 if(Number.isFinite(Number(o.fixedBonus))&&Number(o.fixedBonus)>0)bonus=Math.floor(Number(o.fixedBonus));
 else if(Number.isFinite(Number(o.rate))&&Number(o.rate)>0)bonus=Math.floor((amount*Number(o.rate)+1e-8)/100);
 else return 0;
 if(o.maxBonus!=null&&Number.isFinite(Number(o.maxBonus)))bonus=Math.min(bonus,Number(o.maxBonus));
 return Math.max(0,bonus);
}
function couponStoreOffer(store,provider,payment=null){
 const offers=couponOffers(store,provider,payment).filter(o=>o.rankable!==false);
 if(provider==='vpass')return offers.sort((a,b)=>Number(b.rate||0)-Number(a.rate||0))[0]||null;
 const st=couponState(store);
 return offers.filter(o=>st.checked[o.id||provider+'|'+o.brand]&&couponPoints(o,st.amount)>0)
   .sort((a,b)=>couponPoints(b,st.amount)-couponPoints(a,st.amount)||Number(b.rate||0)-Number(a.rate||0))[0]||null;
}
function storeHasCouponProvider(store,provider){return store.payments.some(p=>couponPaymentProvider(p)===provider);}
function refreshCouponBonus(store){
 store.payments=store.payments.filter(p=>!['vpassCouponCard','paypayPublicCoupon'].includes(p.id));
 const vp=couponStoreOffer(store,'vpass'),pp=couponStoreOffer(store,'paypay');
 if(vp&&!store.payments.some(p=>couponPaymentProvider(p)==='vpass'))store.payments.push({...METHODS.card,id:'vpassCouponCard',n:'三井住友カード / Olive',r:'0.5%',x:'Vクーポン対象カード・通常0.5%設定',conditions:[...METHODS.card.conditions],src:['sm'],rankable:true});
 if(pp&&!store.payments.some(p=>couponPaymentProvider(p)==='paypay'))store.payments.push({...METHODS.paypay,id:'paypayPublicCoupon',x:pp.paymentRoute||'公開キャンペーンの対象決済',rankable:true});
 for(const p of store.payments){
  p.autoCouponRate=0;p.autoCoupon=null;p.couponPoints=null;
  const provider=couponPaymentProvider(p),o=provider?couponStoreOffer(store,provider,p):null;
  if(!o||!p.rankable)continue;
  p.autoCoupon=o;
  if(provider==='vpass')p.autoCouponRate=Number(o.rate)||0;
  else{
   const amount=couponState(store).amount,points=couponPoints(o,amount);
   p.couponPoints=points;
   p.autoCouponRate=amount>0?points/amount*100:0;
  }
 }
}
function comparisonRate(p){return configuredRate(p.r)+(p.ownerRate||0)+(p.autoCouponRate||0);}
function comparisonLabel(p){return p.ownerRate||p.autoCouponRate?comparisonRate(p).toFixed(2).replace(/0$/,'')+'%':p.r;}
function couponProviderLabel(o){return COUPON_PROVIDERS[o&&o.provider]?.label||String(o&&o.provider||'キャンペーン');}
function couponDetail(p){
 if(!p.autoCoupon)return '';
 const o=p.autoCoupon,label=couponProviderLabel(o);
 if(o.provider==='vpass')return '通常 '+p.r+' ＋ '+label+' '+p.autoCouponRate+'%（獲得・対象条件を要確認）';
 const benefit=Number.isFinite(Number(o.fixedBonus))&&Number(o.fixedBonus)>0
  ? p.couponPoints+'円相当（定額特典）'
  : p.couponPoints+'pt相当（上限反映）';
 return '通常 '+p.r+' ＋ '+label+' '+benefit+' · '+(o.paymentRoute||o.title||'対象決済');
}
function ensureAutoCouponStyle(){
 if(document.getElementById('autoCouponStyle'))return;
 const el=document.createElement('style');el.id='autoCouponStyle';el.textContent=`
 .auto-coupon-strip{min-width:0;border:1.5px solid #d9d2e1;border-radius:12px;background:#fff7fb;padding:8px 10px;font-size:12px;line-height:1.55}
 .coupon-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}.coupon-line b{font-size:12px}
 .coupon-chip{border-radius:6px;padding:3px 7px;background:#e8f2ff;font-weight:800;overflow-wrap:anywhere}
 .coupon-chip.paypay{background:#ffe8eb}.coupon-chip.rakuten{background:#fff0f0}.coupon-chip.dpay{background:#fff6df}.coupon-chip.aupay{background:#fff0e6}.coupon-chip.aeonpay{background:#f2eaff}.coupon-chip.famipay{background:#e8fff2}
 .coupon-caution{color:var(--muted);font-size:11px;overflow-wrap:anywhere}
 .coupon-source{color:#6742dd;font-size:12px;text-decoration:underline;text-underline-offset:3px}
 .coupon-expand summary{min-height:36px;display:flex;align-items:center;font-size:12px;font-weight:800;list-style:none;gap:7px}
 .coupon-expand summary:before{content:'＋'}.coupon-expand[open] summary:before{content:'−'}
 .coupon-offer{min-width:0;padding:8px 0;border-top:1px solid #e1dbe7;overflow-wrap:anywhere}
 .coupon-offer p{margin:3px 0}.coupon-offer label{display:flex;align-items:flex-start;gap:6px;margin-top:5px;font-size:12px}
 .coupon-offer input[type=checkbox]{width:18px;height:18px;flex:0 0 18px;margin:2px 0;accent-color:#6742dd}
 .coupon-amount{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 0}.coupon-amount label{flex:1;font-size:12px}
 .coupon-amount input{width:130px;max-width:100%;min-width:0;min-height:40px;border:1px solid #b6abbf;border-radius:8px;padding:6px;font-size:16px}
 .coupon-apply{width:100%;min-height:42px;border-radius:9px;border:1.5px solid var(--ink);background:var(--yellow);font-size:14px;font-weight:800;margin-top:5px}
 .coupon-foot{margin-top:5px;font-size:10px;color:var(--muted)}
 .store-head>div{min-width:0}.store-head>button{flex-shrink:0}.rank-grid{min-width:0;grid-template-columns:repeat(2,minmax(0,1fr))}
 .pay-main{min-width:0;flex-wrap:wrap}.pay-name{min-width:0}.pay-rate{flex-shrink:0}.rank-hint{overflow-wrap:anywhere}
 @media(min-width:700px){.rank-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}`;
 document.head.appendChild(el);
}
function couponSafeLink(url){
 try{
  const u=new URL(url),hosts=[
   'paypay.ne.jp','www.paypay.ne.jp','premium.yahoo.co.jp','www.smbc-card.com','vcoupon.smbc-card.com','www.softbank.jp',
   'pay.rakuten.co.jp','service.smt.docomo.ne.jp','media.aupay.wallet.auone.jp','aupay.wallet.auone.jp',
   'www.aeon.co.jp','aeon.co.jp','famipay.famidigi.jp'
  ];
  return u.protocol==='https:'&&hosts.includes(u.hostname)?url:'';
 }catch(_){return '';}
}
function couponOfferKey(o){return o.id||o.provider+'|'+o.brand+'|'+(o.start||'')+'|'+(o.end||'');}
function couponOfferBounds(o){
 const bits=[];
 if(o.start&&o.end)bits.push(o.start+'〜'+o.end);
 if(o.minSpend!=null)bits.push(Number(o.minSpend).toLocaleString()+'円以上');
 if(o.maxBonus!=null)bits.push('上限'+Number(o.maxBonus).toLocaleString()+(o.bonusKind==='discount'?'円':'pt')+(o.capScope?'/'+o.capScope:''));
 if(o.maxUses)bits.push(o.maxUses+'回まで');
 return bits.join(' · ');
}
function couponStrip(store){
 ensureAutoCouponStyle();const esc=escapeHtml,st=couponState(store);
 const providers=Object.keys(COUPON_PROVIDERS);
 const offers=providers.flatMap(provider=>couponOffers(store,provider)).filter(o=>
   o.provider==='vpass'||o.provider==='paypay'||storeHasCouponProvider(store,o.provider)
 );
 const byProvider={};for(const o of offers)(byProvider[o.provider]||(byProvider[o.provider]=[])).push(o);
 const chips=providers.filter(p=>byProvider[p]?.length).map(p=>'<span class="coupon-chip '+esc(p)+'">'+esc(COUPON_PROVIDERS[p].label)+' '+byProvider[p].length+'件</span>').join('');
 const selectable=offers.filter(o=>o.provider!=='vpass');
 const selected=selectable.filter(o=>st.checked[couponOfferKey(o)]&&o.rankable!==false&&couponPoints(o,st.amount)>0);
 const rows=selectable.map(o=>{
  const key=couponOfferKey(o),bounds=couponOfferBounds(o);
  const rankable=o.rankable!==false&&o.termsVerified;
  const benefit=Number.isFinite(Number(o.fixedBonus))&&Number(o.fixedBonus)>0
   ? Number(o.fixedBonus).toLocaleString()+'円相当'
   : Number(o.rate)>0?(rankable?'+'+Number(o.rate)+'%':'最大・特典率 '+Number(o.rate)+'%'):'特典あり';
  const source=couponSafeLink(o.sourceUrl);
  return '<div class="coupon-offer"><b>'+esc(couponProviderLabel(o))+' · '+esc(o.title||o.brand)+' · '+esc(benefit)+'</b>'
   +(o.paymentRoute?'<p>'+esc(o.paymentRoute)+'</p>':'')
   +(bounds?'<p class="coupon-caution">'+esc(bounds)+'</p>':'')
   +'<p class="coupon-caution">'+esc(o.requirements||o.note||'公式条件を確認してください。')+'</p>'
   +(source?'<a class="coupon-source" href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">公式条件</a>':'')
   +(rankable?'<label><input type="checkbox" data-coupon-key="'+esc(key)+'"'+(st.checked[key]?' checked':'')+'>今回使える（対象・エントリー・未使用枠などを確認）</label>':'<p class="coupon-caution">抽選・累計購入・対象商品などのため順位には自動反映しません。</p>')
   +'</div>';
 }).join('');
 const vp=byProvider.vpass||[];
 const vpHtml=vp.length?'<p><a class="coupon-source" href="'+esc(couponSafeLink(vp[0].sourceUrl))+'" target="_blank" rel="noopener noreferrer">Vクーポン公式で獲得・条件確認</a></p>':'';
 const detail=selectable.length?'<details class="coupon-expand"><summary>主要Payのキャンペーン条件を確認</summary>'
  +'<div class="coupon-amount"><label for="couponAmount">対象商品の支払額（円）</label><input id="couponAmount" type="number" inputmode="numeric" min="1" step="1" placeholder="例 3000" value="'+(st.amount||'')+'"></div>'
  +rows+'<p class="coupon-caution">同じ決済では今回の支払額に対して最も得な確認済み1件だけを比較。抽選・累計条件・商品限定など、単純な還元率にできない特典は順位へ足しません。</p>'
  +'<button id="couponApply" type="button" class="coupon-apply">確認した条件で順位を計算</button></details>':'';
 const status=selected.length?'<div class="coupon-caution">反映中：'+selected.map(o=>esc(couponProviderLabel(o)+' '+couponPoints(o,st.amount)+(o.bonusKind==='discount'?'円相当':'pt相当'))).join(' ／ ')+'</div>':'';
 const when=COUPON_FEED.updatedAt?new Date(COUPON_FEED.updatedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'未取得';
 return '<section class="auto-coupon-strip" aria-label="公開キャンペーン"><div class="coupon-line"><b>公開キャンペーン</b>'
  +(chips||'<span class="coupon-chip">'+(couponLoading?'確認中':couponFailed?'取得未完了':'該当なし')+'</span>')+'</div>'+status+detail+vpHtml
  +'<div class="coupon-foot">公開情報だけを使用。掲載未検出＝配布なしではありません。アプリ個別配信・獲得済み状態・利用済み枠は取得しません。更新 '+esc(when)+(couponFailed?' · 一部取得失敗':'')+'</div></section>';
}
function bindCouponControls(store,context){
 const btn=$('couponApply');if(!btn)return;
 btn.onclick=()=>{
  const checked=Array.from(document.querySelectorAll('[data-coupon-key]:checked')).map(el=>el.dataset.couponKey);
  const st=couponState(store);
  if(!checked.length){st.amount=0;st.checked={};refreshStoreSummary(store);renderPayment(store,context);return;}
  const input=$('couponAmount'),amount=Number(input.value);
  if(!Number.isFinite(amount)||amount<=0||!Number.isInteger(amount)){input.setCustomValidity('対象商品の支払額を1円以上の整数で入力してください。');input.reportValidity();return;}
  input.setCustomValidity('');st.amount=amount;st.checked={};for(const key of checked)st.checked[key]=true;
  refreshStoreSummary(store);renderPayment(store,context);
 };
}
async function loadPublicCoupons(){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
 try{
  const r=await fetch('./coupon-feed.json?ts='+Date.now(),{cache:'no-store',signal:ctl.signal});
  if(!r.ok)throw new Error('coupon HTTP '+r.status);
  const d=await r.json();if(!d||!Array.isArray(d.offers))throw new Error('invalid coupon feed');
  COUPON_FEED=d;couponFailed=Array.isArray(d.errors)&&d.errors.length>0;
 }catch(e){couponFailed=true;console.warn('Public campaign refresh failed:',e.message);}
 finally{clearTimeout(timer);couponLoading=false;STORE_DATA.forEach(refreshStoreSummary);if(lastSelectedStore&&!$('resultPanel').classList.contains('hidden'))renderPayment(lastSelectedStore,lastCouponContext);}
}
