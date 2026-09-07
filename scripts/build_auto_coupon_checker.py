from pathlib import Path
import hashlib,base64,re

src=Path('checker-20260907.js')
out=Path('checker-20260907-autocoupons.js')
s=src.read_text(encoding='utf-8')

# Coupon feed state near audit initialization.
needle="const AUDIT=window.PAYMENT_AUDIT_DATA;"
s=s.replace(needle,needle+"\nlet COUPON_FEED={offers:[],updatedAt:''};",1)

old="""let ownerSetting=readOwnerSetting();
function comparisonRate(payment){return configuredRate(payment.r)+(payment.ownerRate||0);}
function comparisonLabel(payment){return payment.ownerRate?comparisonRate(payment).toFixed(1)+'%':payment.r;}
function refreshStoreSummary(store){
 for(const payment of store.payments)payment.ownerRate=store.local.aeonOwners&&['aeonGroup','cash'].includes(payment.id)?ownerSetting.rate:0;
 const top=store.payments.filter(p=>p.rankable).sort(paymentOrder);"""
new="""let ownerSetting=readOwnerSetting();
function couponNorm(v){return String(v||'').toLowerCase().normalize('NFKC').replace(/[\s　・･\-‐‑–—ー()（）]/g,'').replace(/ホールディングス|hd|株式会社|有限会社/g,'');}
function couponPaymentProvider(p){const n=String(p&&p.n||'');if(n==='PayPay')return'paypay';if(n==='Olive'||n==='Olive通常'||n.includes('三井住友カード'))return'vpass';return'';}
function couponOfferFor(store,p){
 const provider=couponPaymentProvider(p);if(!provider)return null;
 const names=[store.store,...(store.aliases||[])].map(couponNorm).filter(Boolean);
 const offers=(COUPON_FEED.offers||[]).filter(o=>o.provider===provider);
 const exact=offers.filter(o=>names.includes(couponNorm(o.brand)));
 const pool=exact.length?exact:offers.filter(o=>{const b=couponNorm(o.brand);return b.length>=4&&names.some(n=>n.length>=4&&(n.includes(b)||b.includes(n)));});
 return pool.sort((a,b)=>(Number(b.rate)||0)-(Number(a.rate)||0))[0]||null;
}
function refreshCouponBonus(store){for(const p of store.payments){p.autoCouponRate=0;p.autoCoupon=null;const o=couponOfferFor(store,p);if(o){p.autoCouponRate=Math.max(0,Number(o.rate)||0);p.autoCoupon=o;}}}
function comparisonRate(payment){return configuredRate(payment.r)+(payment.ownerRate||0)+(payment.autoCouponRate||0);}
function comparisonLabel(payment){return payment.ownerRate||payment.autoCouponRate?comparisonRate(payment).toFixed(1)+'%':payment.r;}
function refreshStoreSummary(store){
 for(const payment of store.payments)payment.ownerRate=store.local.aeonOwners&&['aeonGroup','cash'].includes(payment.id)?ownerSetting.rate:0;
 refreshCouponBonus(store);
 const top=store.payments.filter(p=>p.rankable).sort(paymentOrder);"""
if old not in s: raise SystemExit('comparison block not found')
s=s.replace(old,new,1)

old="function paymentLabel(payment){return payment.n+'（'+comparisonLabel(payment)+(payment.ownerRate?'・決済'+payment.r+'＋株主優待'+payment.ownerRate.toFixed(1)+'%':'')+(payment.x?'・'+payment.x:'')+'）';}"
new="function paymentLabel(payment){return payment.n+'（'+comparisonLabel(payment)+(payment.ownerRate?'・決済'+payment.r+'＋株主優待'+payment.ownerRate.toFixed(1)+'%':'')+(payment.autoCouponRate?'・公開クーポン候補+'+payment.autoCouponRate.toFixed(1)+'%':'')+(payment.x?'・'+payment.x:'')+'）';}"
if old not in s: raise SystemExit('payment label not found')
s=s.replace(old,new,1)

# Compact coupon strip after owner controls.
marker="""function ownerControls(store){
 if(!store.local.aeonOwners)return '';
 return '<div class=\"owners-setting\"><label for=\"ownersRate\">オーナーズカード</label><select id=\"ownersRate\" aria-label=\"オーナーズカードの返金率\">'+OWNER_RATES.map(rate=>'<option value=\"'+rate+'\"'+(rate===ownerSetting.rate?' selected':'')+'>'+(rate===0?'今回は使わない':rate+'%返金')+'</option>').join('')+'</select><small id=\"ownersNote\">'+(ownerSetting.confirmed?'選択した率で比較':'3%は仮設定・実際の返金率を選択')+'</small></div>';
}
const STORE_DATA="""
insert="""function ownerControls(store){
 if(!store.local.aeonOwners)return '';
 return '<div class=\"owners-setting\"><label for=\"ownersRate\">オーナーズカード</label><select id=\"ownersRate\" aria-label=\"オーナーズカードの返金率\">'+OWNER_RATES.map(rate=>'<option value=\"'+rate+'\"'+(rate===ownerSetting.rate?' selected':'')+'>'+(rate===0?'今回は使わない':rate+'%返金')+'</option>').join('')+'</select><small id=\"ownersNote\">'+(ownerSetting.confirmed?'選択した率で比較':'3%は仮設定・実際の返金率を選択')+'</small></div>';
}
function ensureAutoCouponStyle(){if(document.getElementById('autoCouponStyle'))return;const st=document.createElement('style');st.id='autoCouponStyle';st.textContent='.auto-coupon-strip{display:flex;align-items:center;gap:6px;flex-wrap:wrap;border:2px solid var(--ink);border-radius:12px;background:#fff7fb;padding:7px 9px;font-size:11px;font-weight:750}.auto-coupon-strip b{font-size:12px}.coupon-chip{display:inline-flex;align-items:center;border:1.5px solid var(--ink);border-radius:999px;background:#fff;padding:3px 7px;font-weight:850}.coupon-chip.paypay{background:#ffe8eb}.coupon-chip.vpass{background:#e8f2ff}.coupon-caution{color:var(--muted);font-weight:650}.coupon-source{margin-left:auto;color:#6742dd;text-decoration:none;font-weight:800}@media(max-width:600px){.auto-coupon-strip{padding:6px 8px}.coupon-source{margin-left:0}}';document.head.appendChild(st);}
function couponStrip(store){
 ensureAutoCouponStyle();const seen=new Set(),items=[];
 for(const p of store.payments){const o=p.autoCoupon;if(!o)continue;const key=o.provider+'|'+o.brand+'|'+o.rate;if(seen.has(key))continue;seen.add(key);items.push(o);}
 if(!items.length)return '';
 const chips=items.map(o=>'<span class=\"coupon-chip '+escapeHtml(o.provider)+'\">'+escapeHtml(o.provider==='paypay'?'PayPay':'Vクーポン')+' +'+escapeHtml(String(o.rate))+'%</span>').join('');
 const url=items[0].sourceUrl||'';
 return '<div class=\"auto-coupon-strip\"><b>🎟 自動検出</b>'+chips+'<span class=\"coupon-caution\">獲得済み・対象条件なら順位に反映</span>'+(url?'<a class=\"coupon-source\" href=\"'+escapeHtml(url)+'\" target=\"_blank\" rel=\"noopener noreferrer\">公式で確認</a>':'')+'</div>';
}
const STORE_DATA="""
if marker not in s: raise SystemExit('owner controls marker not found')
s=s.replace(marker,insert,1)

# Rank detail wording.
old="""  const hint=p.ownerRate?'株主優待込み':i===0?(store.local.partial?'確認済み候補':'おすすめ'):tied?'同じ還元率':'';
  const detail=p.ownerRate?'決済 '+p.r+' ＋ 株主優待 '+p.ownerRate.toFixed(1)+'%':p.x;"""
new="""  const hint=p.autoCouponRate?'クーポン候補込み':p.ownerRate?'株主優待込み':i===0?(store.local.partial?'確認済み候補':'おすすめ'):tied?'同じ還元率':'';
  const detailParts=[];if(p.ownerRate)detailParts.push('決済 '+p.r+' ＋ 株主優待 '+p.ownerRate.toFixed(1)+'%');else if(p.x)detailParts.push(p.x);if(p.autoCouponRate)detailParts.push((p.autoCoupon?.provider==='paypay'?'PayPay':'Vクーポン')+' +'+p.autoCouponRate.toFixed(1)+'%（獲得済み・対象なら）');const detail=detailParts.join(' · ');"""
if old not in s: raise SystemExit('rank detail block not found')
s=s.replace(old,new,1)

old="</div>'+ownerControls(store)+'<div class=\"rank-grid\">"
new="</div>'+ownerControls(store)+couponStrip(store)+'<div class=\"rank-grid\">"
if old not in s: raise SystemExit('result insert point not found')
s=s.replace(old,new,1)

s=s.replace('期間限定キャンペーン・クーポン・チャージ元特典は自動加算しません。','PayPay・Vクーポンは公式公開ページから自動検出した候補のみ条件付きで順位に反映します。Myクーポンの獲得済み状態や個別配信は外部から取得できないため、利用前に公式アプリで確認してください。その他の期間限定キャンペーン・チャージ元特典は自動加算しません。',1)

# Async same-origin feed load after store data and lastSelectedStore exist.
needle="let lastSelectedStore=null;"
loader="""let lastSelectedStore=null;
fetch('./coupon-feed.json?ts='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('coupon feed '+r.status))).then(d=>{COUPON_FEED=d||{offers:[]};STORE_DATA.forEach(refreshStoreSummary);if(lastSelectedStore)renderPayment(lastSelectedStore);}).catch(()=>{});"""
if needle not in s: raise SystemExit('lastSelectedStore not found')
s=s.replace(needle,loader,1)

out.write_text(s,encoding='utf-8')
data=out.read_bytes();integrity='sha384-'+base64.b64encode(hashlib.sha384(data).digest()).decode()

for name in ['index.html','app-v2.html','app-v3.html']:
    p=Path(name);h=p.read_text(encoding='utf-8')
    h=re.sub(r'checker-20260907(?:-coupons|-autocoupons)?\.js\?v=[^\"\']+','checker-20260907-autocoupons.js?v=20260907-auto2',h)
    h=re.sub(r'(checker-20260907-autocoupons\.js\?v=20260907-auto2\" integrity=\")[^\"]+(\")',r'\1'+integrity+r'\2',h)
    h=h.replace('data-ui-version="20260907-coupons1"','data-ui-version="20260907-auto2"').replace('data-ui-version="20260907-icons3"','data-ui-version="20260907-auto2"')
    p.write_text(h,encoding='utf-8')
print(integrity)
