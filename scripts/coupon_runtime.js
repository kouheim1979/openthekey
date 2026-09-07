// Public coupon information only. Confirmation is a local calculation input, NOT claiming.
const COUPON_STATE={}; // Page-session only: never assume that a previously used coupon is still usable.
let couponLoading=true,couponFailed=false,lastCouponContext=null;
function couponNorm(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/[\s　・･‐‑–—ー()（）-]/g,'');}
function couponPaymentProvider(p){const n=String(p&&p.n||'');if(n==='PayPay')return'paypay';if(n==='Olive'||n==='Olive通常'||n.includes('三井住友カード'))return'vpass';return'';}
function couponLive(o,now=Date.now()){
 const checked=Date.parse(o.checkedAt||COUPON_FEED.updatedAt||'');
 if(!Number.isFinite(checked)||now-checked>48*3600000||checked-now>3600000)return false;
 if(o.start&&now<Date.parse(o.start+'T00:00:00+09:00'))return false;
 if(o.end&&now>Date.parse(o.end+'T23:59:59+09:00'))return false;
 return Number.isFinite(Number(o.rate))&&Number(o.rate)>0&&Number(o.rate)<=100;
}
function couponMatches(store,o){
 const names=[store.store,...(store.aliases||[])].map(couponNorm);
 return [o.brand,...(o.aliases||[])].some(b=>names.includes(couponNorm(b)));
}
function couponOffers(store,provider){return (COUPON_FEED.offers||[]).filter(o=>o.provider===provider&&couponLive(o)&&couponMatches(store,o));}
function couponState(store){return COUPON_STATE[store.store]||(COUPON_STATE[store.store]={amount:0,checked:{}});}
function couponPoints(o,amount){
 if(!o.termsVerified||!o.start||!o.end||!Number.isFinite(amount)||amount<=0)return 0;
 if(o.minSpend!=null&&amount<Number(o.minSpend))return 0;
 if(o.maxBonus==null||!Number.isFinite(Number(o.maxBonus)))return 0;
 // The checkbox confirms the full public cap is still unused. Partial used balances are not known.
 return Math.min(Math.floor((amount*Number(o.rate)+1e-8)/100),Number(o.maxBonus));
}
function couponStoreOffer(store,provider){
 const offers=couponOffers(store,provider);
 if(provider!=='paypay')return offers.sort((a,b)=>b.rate-a.rate)[0]||null;
 const st=couponState(store);
 return offers.filter(o=>st.checked[o.id]&&couponPoints(o,st.amount)>0)
   .sort((a,b)=>couponPoints(b,st.amount)-couponPoints(a,st.amount)||b.rate-a.rate)[0]||null;
}
function refreshCouponBonus(store){
 store.payments=store.payments.filter(p=>!['vpassCouponCard','paypayPublicCoupon'].includes(p.id));
 const vp=couponStoreOffer(store,'vpass'),pp=couponStoreOffer(store,'paypay');
 if(vp&&!store.payments.some(p=>couponPaymentProvider(p)==='vpass'))store.payments.push({...METHODS.card,id:'vpassCouponCard',n:'三井住友カード / Olive',r:'0.5%',x:'Vクーポン対象カード・通常0.5%設定',conditions:[...METHODS.card.conditions],src:['sm'],rankable:true});
 if(pp&&!store.payments.some(p=>couponPaymentProvider(p)==='paypay'))store.payments.push({...METHODS.paypay,id:'paypayPublicCoupon',x:pp.paymentRoute||'公開クーポンの対象決済',rankable:true});
 for(const p of store.payments){
  p.autoCouponRate=0;p.autoCoupon=null;p.couponPoints=null;
  const provider=couponPaymentProvider(p),o=provider==='vpass'?vp:provider==='paypay'?pp:null;
  if(!o||!p.rankable)continue;
  p.autoCoupon=o;
  if(provider==='paypay'){p.couponPoints=couponPoints(o,couponState(store).amount);p.autoCouponRate=p.couponPoints/couponState(store).amount*100;}
  else p.autoCouponRate=Number(o.rate);
 }
}
function comparisonRate(p){return configuredRate(p.r)+(p.ownerRate||0)+(p.autoCouponRate||0);}
function comparisonLabel(p){return p.ownerRate||p.autoCouponRate?comparisonRate(p).toFixed(2).replace(/0$/,'')+'%':p.r;}
function couponDetail(p){
 if(!p.autoCoupon)return '';
 if(p.autoCoupon.provider==='paypay')return '通常 '+p.r+' ＋ クーポン '+p.couponPoints+'pt（上限反映） · '+(p.autoCoupon.paymentRoute||'対象決済');
 return '通常 '+p.r+' ＋ Vクーポン '+p.autoCouponRate+'%（獲得・対象条件を要確認）';
}
function ensureAutoCouponStyle(){
 if(document.getElementById('autoCouponStyle'))return;
 const el=document.createElement('style');el.id='autoCouponStyle';el.textContent=`
 .auto-coupon-strip{min-width:0;border:1.5px solid #d9d2e1;border-radius:12px;background:#fff7fb;padding:8px 10px;font-size:12px;line-height:1.55}
 .coupon-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}.coupon-line b{font-size:12px}
 .coupon-chip{border-radius:6px;padding:3px 7px;background:#e8f2ff;font-weight:800;overflow-wrap:anywhere}
 .coupon-chip.paypay{background:#ffe8eb}.coupon-caution{color:var(--muted);font-size:11px;overflow-wrap:anywhere}
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
function couponSafeLink(url){try{const u=new URL(url);return u.protocol==='https:'&&['paypay.ne.jp','www.paypay.ne.jp','premium.yahoo.co.jp','www.smbc-card.com','vcoupon.smbc-card.com','www.softbank.jp'].includes(u.hostname)?url:'';}catch(_){return '';}}
function couponStrip(store){
 ensureAutoCouponStyle();const pp=couponOffers(store,'paypay'),vp=couponOffers(store,'vpass'),st=couponState(store),esc=escapeHtml;
 const vpHtml=vp.length?'<span class="coupon-chip">Vクーポン +'+esc(String(vp[0].rate))+'%・条件付き</span>':'';
 const ppHtml='<span class="coupon-chip paypay">PayPay '+(pp.length?pp.length+'件・会員限定':couponLoading?'確認中':couponFailed?'取得未完了':'公開掲載未検出')+'</span>';
 const selected=couponStoreOffer(store,'paypay');
 const rows=pp.map((o,i)=>{
  const scope=o.capScope==='period'?'期間':'回';
  const bounds=o.termsVerified?o.start+'〜'+o.end+' · 上限'+o.maxBonus+'pt/'+scope+' · '+(o.maxUses?o.maxUses+'回まで':'期間上限まで'):'上限・有効期間を確認できていないため順位には未反映';
  const portal=/^\d+$/.test(o.couponId||'')?'paypay://internalembed?url=https://www.paypay.ne.jp/portal/coupon-corner/coupons/'+o.couponId:'';
  return '<div class="coupon-offer"><b>'+esc(o.audience==='softbank'?'ソフトバンク限定':'LYPプレミアム限定')+' 最大'+esc(String(o.rate))+'%</b><p>'+esc(o.paymentRoute||o.title||'')+'</p><p class="coupon-caution">'+esc(bounds)+'</p><p class="coupon-caution">'+esc(o.requirements||'')+'</p>'+(portal?'<a class="coupon-source" href="'+esc(portal)+'">PayPayで確認</a> · ':'')+'<a class="coupon-source" href="'+esc(couponSafeLink(o.sourceUrl))+'" target="_blank" rel="noopener noreferrer">公式条件</a>'+(o.termsVerified?'<label><input type="checkbox" data-pp-index="'+i+'"'+(st.checked[o.id]?' checked':'')+'>今回使える（獲得済み・対象会員・対象決済・未使用を確認）</label>':'')+'</div>';
 }).join('');
 const detail=pp.length?'<details class="coupon-expand"><summary>PayPayの条件・上限を確認して比較</summary><div class="coupon-amount"><label for="couponAmount">対象商品の支払額（円）</label><input id="couponAmount" type="number" inputmode="numeric" min="1" step="1" placeholder="例 3000" value="'+(st.amount||'')+'"></div>'+rows+'<p class="coupon-caution">同じ店は付与額が最大の1枚だけ。最低利用額・対象外商品・早期終了はアプリで確認。使用済み・上限を一部使用済みのものはチェックしないでください。</p><button id="couponApply" type="button" class="coupon-apply">確認した条件で順位を計算</button></details>':'';
 const status=selected?'<div class="coupon-caution">反映：'+esc(selected.audience==='softbank'?'ソフトバンク限定':'LYP限定')+' · 対象額'+st.amount.toLocaleString()+'円 → '+couponPoints(selected,st.amount)+'pt</div>':'';
 const when=COUPON_FEED.updatedAt?new Date(COUPON_FEED.updatedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'未取得';
 return '<section class="auto-coupon-strip" aria-label="公開クーポン"><div class="coupon-line"><b>クーポン自動検出</b>'+vpHtml+ppHtml+'</div>'+status+detail+(vp.length?'<a class="coupon-source" href="'+esc(couponSafeLink(vp[0].sourceUrl))+'" target="_blank" rel="noopener noreferrer">Vクーポン公式で獲得・条件確認</a>':'')+'<div class="coupon-foot">一般向け・Myクーポンは未取得。掲載未検出＝配布なしではありません。更新 '+esc(when)+(couponFailed?' · 一部取得失敗':'')+'</div></section>';
}
function bindCouponControls(store,context){
 const btn=$('couponApply');if(!btn)return;
 btn.onclick=()=>{
  const input=$('couponAmount'),amount=Number(input.value);
  if(!Number.isFinite(amount)||amount<=0||!Number.isInteger(amount)){input.setCustomValidity('対象商品の支払額を1円以上の整数で入力してください。');input.reportValidity();return;}
  input.setCustomValidity('');const st=couponState(store);st.amount=amount;st.checked={};
  const offers=couponOffers(store,'paypay');
  document.querySelectorAll('[data-pp-index]').forEach(el=>{const o=offers[Number(el.dataset.ppIndex)];if(o&&el.checked)st.checked[o.id]=true;});
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
 }catch(e){couponFailed=true;console.warn('Public coupon refresh failed:',e.message);}
 finally{clearTimeout(timer);couponLoading=false;STORE_DATA.forEach(refreshStoreSummary);if(lastSelectedStore&&!$('resultPanel').classList.contains('hidden'))renderPayment(lastSelectedStore,lastCouponContext);}
}
