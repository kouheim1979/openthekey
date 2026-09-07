from pathlib import Path
import hashlib, base64, re

src=Path('checker-20260907.js')
out=Path('checker-20260907-coupons.js')
s=src.read_text(encoding='utf-8')

old="""const OWNER_RATES=[0,1,2,3,4,5,7];
function readOwnerSetting(){try{const raw=localStorage.getItem(OWNER_KEY);const value=Number(raw);if(raw!==null&&OWNER_RATES.includes(value))return{rate:value,confirmed:true};}catch(_){}return{rate:3,confirmed:false};}
let ownerSetting=readOwnerSetting();
function comparisonRate(payment){return configuredRate(payment.r)+(payment.ownerRate||0);}
function comparisonLabel(payment){return payment.ownerRate?comparisonRate(payment).toFixed(1)+'%':payment.r;}
function refreshStoreSummary(store){
 for(const payment of store.payments)payment.ownerRate=store.local.aeonOwners&&['aeonGroup','cash'].includes(payment.id)?ownerSetting.rate:0;
 const top=store.payments.filter(p=>p.rankable).sort(paymentOrder);"""
new="""const OWNER_RATES=[0,1,2,3,4,5,7];
function readOwnerSetting(){try{const raw=localStorage.getItem(OWNER_KEY);const value=Number(raw);if(raw!==null&&OWNER_RATES.includes(value))return{rate:value,confirmed:true};}catch(_){}return{rate:3,confirmed:false};}
let ownerSetting=readOwnerSetting();

// Store-specific PayPay / SMBC(Vpass) coupon settings. These stay only in this browser.
const COUPON_KEY='payment-checker-coupons-v1';
function readCouponSettings(){try{const x=JSON.parse(localStorage.getItem(COUPON_KEY)||'{}');return x&&typeof x==='object'?x:{};}catch(_){return{};}}
let couponSettings=readCouponSettings();
function couponStoreKey(store){return String(store&&store.store||'').trim();}
function couponProvider(payment){const n=String(payment&&payment.n||'');if(n==='PayPay')return'paypay';if(n==='Olive'||n==='Olive通常'||n.includes('三井住友カード'))return'smbc';return'';}
function couponExpired(c){if(!c||!c.until)return false;const end=new Date(String(c.until)+'T23:59:59');return Number.isFinite(end.getTime())&&Date.now()>end.getTime();}
function couponEffectiveRate(c,amount){
 if(!c||!c.enabled||couponExpired(c))return 0;
 const rate=Math.max(0,Number(c.rate)||0),min=Math.max(0,Number(c.minSpend)||0),max=Math.max(0,Number(c.maxBonus)||0),a=Math.max(0,Number(amount)||0);
 if(!rate)return 0;if(min&&(!a||a<min))return 0;
 return max&&a?Math.min(rate,max/a*100):rate;
}
function applyCouponBonus(store){
 const cfg=couponSettings[couponStoreKey(store)]||{},amount=Math.max(0,Number(cfg.amount)||0);
 for(const payment of store.payments){
  payment.couponRate=0;payment.couponProvider='';payment.couponNominal=0;payment.couponCapped=false;
  const provider=couponProvider(payment);if(!provider)continue;const c=cfg[provider];if(!c)continue;
  const bonus=couponEffectiveRate(c,amount);if(!bonus)continue;
  payment.couponRate=bonus;payment.couponProvider=provider;payment.couponNominal=Math.max(0,Number(c.rate)||0);payment.couponCapped=bonus+1e-9<payment.couponNominal;
 }
}
function comparisonRate(payment){return configuredRate(payment.r)+(payment.ownerRate||0)+(payment.couponRate||0);}
function comparisonLabel(payment){return payment.ownerRate||payment.couponRate?comparisonRate(payment).toFixed(1)+'%':payment.r;}
function refreshStoreSummary(store){
 for(const payment of store.payments)payment.ownerRate=store.local.aeonOwners&&['aeonGroup','cash'].includes(payment.id)?ownerSetting.rate:0;
 applyCouponBonus(store);
 const top=store.payments.filter(p=>p.rankable).sort(paymentOrder);"""
if old not in s: raise SystemExit('owner/comparison block not found')
s=s.replace(old,new,1)

old="""function ownerControls(store){
 if(!store.local.aeonOwners)return '';
 return '<div class=\"owners-setting\"><label for=\"ownersRate\">オーナーズカード</label><select id=\"ownersRate\" aria-label=\"オーナーズカードの返金率\">'+OWNER_RATES.map(rate=>'<option value=\"'+rate+'\"'+(rate===ownerSetting.rate?' selected':'')+'>'+(rate===0?'今回は使わない':rate+'%返金')+'</option>').join('')+'</select><small id=\"ownersNote\">'+(ownerSetting.confirmed?'選択した率で比較':'3%は仮設定・実際の返金率を選択')+'</small></div>';
}
const STORE_DATA="""
new="""function ownerControls(store){
 if(!store.local.aeonOwners)return '';
 return '<div class=\"owners-setting\"><label for=\"ownersRate\">オーナーズカード</label><select id=\"ownersRate\" aria-label=\"オーナーズカードの返金率\">'+OWNER_RATES.map(rate=>'<option value=\"'+rate+'\"'+(rate===ownerSetting.rate?' selected':'')+'>'+(rate===0?'今回は使わない':rate+'%返金')+'</option>').join('')+'</select><small id=\"ownersNote\">'+(ownerSetting.confirmed?'選択した率で比較':'3%は仮設定・実際の返金率を選択')+'</small></div>';
}
function ensureCouponStyle(){if(document.getElementById('couponStyle'))return;const style=document.createElement('style');style.id='couponStyle';style.textContent='.coupon-setting{border:2px solid var(--ink);border-radius:15px;background:#fff2f8;padding:10px 11px;margin:9px 0}.coupon-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.coupon-head strong{font-size:14px}.coupon-head small,.coupon-help{font-size:11px;color:var(--muted);font-weight:700}.coupon-amount{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;margin-bottom:7px}.coupon-amount label{font-size:12px;font-weight:800}.coupon-amount input,.coupon-line input[type=number],.coupon-line input[type=date]{min-height:36px;border:1.5px solid var(--ink);border-radius:9px;background:white;padding:5px 7px;font-size:14px;min-width:0}.coupon-line{display:grid;grid-template-columns:auto minmax(100px,1fr) 78px 84px 132px;gap:6px;align-items:center;padding:7px 0;border-top:1px dashed #c9bfd0}.coupon-line label{font-size:12px;font-weight:850;display:flex;align-items:center;gap:5px}.coupon-line .unit{display:flex;align-items:center;gap:3px;font-size:11px;font-weight:750}.coupon-actions{display:flex;gap:7px;margin-top:8px}.coupon-actions .btn{min-height:38px;flex:1}.coupon-active{margin-top:7px;font-size:12px;font-weight:850;color:#8a2458}@media(max-width:600px){.coupon-line{grid-template-columns:1fr 80px 1fr 1fr}.coupon-line label{grid-column:1/-1}.coupon-line .date-wrap{grid-column:1/-1}.coupon-amount{grid-template-columns:1fr}.coupon-actions{flex-wrap:wrap}}';document.head.appendChild(style);}
function couponControls(store){
 ensureCouponStyle();const cfg=couponSettings[couponStoreKey(store)]||{},pp=cfg.paypay||{},sm=cfg.smbc||{},num=v=>Number(v)||0;
 const active=[];if(pp.enabled)active.push('PayPay +'+num(pp.rate)+'%');if(sm.enabled)active.push('Vpass +'+num(sm.rate)+'%');
 const line=(id,label,c)=>'<div class=\"coupon-line\"><label><input id=\"'+id+'Enabled\" type=\"checkbox\"'+(c.enabled?' checked':'')+'> '+label+'</label><span class=\"unit\"><input id=\"'+id+'Rate\" type=\"number\" min=\"0\" max=\"100\" step=\"0.1\" value=\"'+escapeHtml(String(num(c.rate)||5))+'\">%上乗せ</span><span class=\"unit\"><input id=\"'+id+'Min\" type=\"number\" min=\"0\" step=\"1\" value=\"'+escapeHtml(String(num(c.minSpend)||''))+'\" placeholder=\"最低\">円〜</span><span class=\"unit\"><input id=\"'+id+'Max\" type=\"number\" min=\"0\" step=\"1\" value=\"'+escapeHtml(String(num(c.maxBonus)||''))+'\" placeholder=\"上限\">pt</span><span class=\"unit date-wrap\">期限 <input id=\"'+id+'Until\" type=\"date\" value=\"'+escapeHtml(String(c.until||''))+'\"></span></div>';
 return '<section class=\"coupon-setting\"><div class=\"coupon-head\"><strong>🎟 クーポンを順位に反映</strong><small>この店だけ保存</small></div><div class=\"coupon-amount\"><label for=\"couponAmount\">今回の支払予定額（任意）</label><input id=\"couponAmount\" type=\"number\" min=\"0\" step=\"1\" value=\"'+escapeHtml(String(num(cfg.amount)||''))+'\" placeholder=\"例 3000\"></div>'+line('ppCoupon','PayPay',pp)+line('smCoupon','三井住友カード / Olive（Vpass）',sm)+'<div class=\"coupon-actions\"><button id=\"couponSaveBtn\" type=\"button\" class=\"btn primary small\">この店に反映</button><button id=\"couponClearBtn\" type=\"button\" class=\"btn ghost small\">設定を消す</button></div>'+(active.length?'<div class=\"coupon-active\">登録中：'+escapeHtml(active.join(' ／ '))+'</div>':'')+'<p class=\"coupon-help\">PayPay/Vpassアプリ側でクーポン獲得・エントリー済みの場合だけONにしてください。最低額・上限を入れると支払予定額から実効還元率を計算します。対象商品・併用可否は各クーポン条件を優先します。</p></section>';
}
function bindCouponControls(store,context){
 const save=$(\"couponSaveBtn\"),clear=$(\"couponClearBtn\");if(!save||!clear)return;
 const read=(id)=>({enabled:!!$(id+'Enabled')?.checked,rate:Math.max(0,Number($(id+'Rate')?.value)||0),minSpend:Math.max(0,Number($(id+'Min')?.value)||0),maxBonus:Math.max(0,Number($(id+'Max')?.value)||0),until:String($(id+'Until')?.value||'')});
 save.onclick=()=>{const cfg={amount:Math.max(0,Number($(\"couponAmount\")?.value)||0),paypay:read('ppCoupon'),smbc:read('smCoupon')};couponSettings[couponStoreKey(store)]=cfg;try{localStorage.setItem(COUPON_KEY,JSON.stringify(couponSettings));}catch(_){}STORE_DATA.forEach(refreshStoreSummary);renderPayment(store,context);};
 clear.onclick=()=>{delete couponSettings[couponStoreKey(store)];try{localStorage.setItem(COUPON_KEY,JSON.stringify(couponSettings));}catch(_){}STORE_DATA.forEach(refreshStoreSummary);renderPayment(store,context);};
}
const STORE_DATA="""
if old not in s: raise SystemExit('ownerControls block not found')
s=s.replace(old,new,1)

old=" const allPayments=store.payments.slice().sort(paymentOrder),payments=allPayments.filter(p=>p.rankable);"
new=" applyCouponBonus(store);\n const allPayments=store.payments.slice().sort(paymentOrder),payments=allPayments.filter(p=>p.rankable);"
if old not in s: raise SystemExit('render payment sort line not found')
s=s.replace(old,new,1)

old="""  const hint=p.ownerRate?'株主優待込み':i===0?(store.local.partial?'確認済み候補':'おすすめ'):tied?'同じ還元率':'';
  const detail=p.ownerRate?'決済 '+p.r+' ＋ 株主優待 '+p.ownerRate.toFixed(1)+'%':p.x;"""
new="""  const hint=p.couponRate?'クーポン込み':p.ownerRate?'株主優待込み':i===0?(store.local.partial?'確認済み候補':'おすすめ'):tied?'同じ還元率':'';
  const detailParts=[];if(p.ownerRate)detailParts.push('決済 '+p.r+' ＋ 株主優待 '+p.ownerRate.toFixed(1)+'%');else if(p.x)detailParts.push(p.x);if(p.couponRate)detailParts.push((p.couponProvider==='paypay'?'PayPay':'Vpass')+'クーポン +'+p.couponRate.toFixed(1)+'%'+(p.couponCapped?'（上限反映）':''));const detail=detailParts.join(' · ');"""
if old not in s: raise SystemExit('rank hint block not found')
s=s.replace(old,new,1)

old="</div>'+ownerControls(store)+'<div class=\"rank-grid\">"
new="</div>'+ownerControls(store)+couponControls(store)+'<div class=\"rank-grid\">"
if old not in s: raise SystemExit('result ownerControls insertion point not found')
s=s.replace(old,new,1)

old=' show($("resultPanel"));$("changeStoreBtn").onclick=()=>{clearView();$("manualSearch").focus();};$("copyBtn").onclick=copyResult;$("resultListBtn").onclick=openStoreList;'
new=' show($("resultPanel"));$("changeStoreBtn").onclick=()=>{clearView();$("manualSearch").focus();};$("copyBtn").onclick=copyResult;$("resultListBtn").onclick=openStoreList;bindCouponControls(store,context);'
if old not in s: raise SystemExit('render bind point not found')
s=s.replace(old,new,1)

old="function paymentLabel(payment){return payment.n+'（'+comparisonLabel(payment)+(payment.ownerRate?'・決済'+payment.r+'＋株主優待'+payment.ownerRate.toFixed(1)+'%':'')+(payment.x?'・'+payment.x:'')+'）';}"
new="function paymentLabel(payment){return payment.n+'（'+comparisonLabel(payment)+(payment.ownerRate?'・決済'+payment.r+'＋株主優待'+payment.ownerRate.toFixed(1)+'%':'')+(payment.couponRate?'・'+(payment.couponProvider==='paypay'?'PayPay':'Vpass')+'クーポン+'+payment.couponRate.toFixed(1)+'%':'')+(payment.x?'・'+payment.x:'')+'）';}"
if old not in s: raise SystemExit('paymentLabel not found')
s=s.replace(old,new,1)

s=s.replace('期間限定キャンペーン・クーポン・チャージ元特典は自動加算しません。','この端末で登録したPayPay／三井住友カード（Vpass）クーポンだけ順位に反映します。その他の期間限定キャンペーン・クーポン・チャージ元特典は自動加算しません。',1)

out.write_text(s,encoding='utf-8')
data=out.read_bytes()
integrity='sha384-'+base64.b64encode(hashlib.sha384(data).digest()).decode()

for name in ['index.html','app-v2.html','app-v3.html']:
    p=Path(name)
    if not p.exists(): continue
    h=p.read_text(encoding='utf-8')
    h=re.sub(r'checker-20260907(?:-coupons)?\.js\?v=[^\"\']+', 'checker-20260907-coupons.js?v=20260907-coupons1', h)
    h=re.sub(r'(checker-20260907-coupons\.js\?v=20260907-coupons1\" integrity=\")[^\"]+(\")', r'\1'+integrity+r'\2', h)
    h=h.replace('data-ui-version="20260907-icons3"','data-ui-version="20260907-coupons1"')
    p.write_text(h,encoding='utf-8')

print('checker bytes',len(data))
print('integrity',integrity)
