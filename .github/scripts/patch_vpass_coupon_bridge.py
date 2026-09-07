from pathlib import Path
import re

builder = Path('scripts/build_auto_coupon_checker.py')
s = builder.read_text(encoding='utf-8')

pattern = re.compile(
    r"function couponPaymentProvider\(p\)\{.*?\}\n"
    r"function couponOfferFor\(store,p\)\{.*?\}\n"
    r"function refreshCouponBonus\(store\)\{.*?\}\n"
    r"function comparisonRate",
    re.S,
)
replacement = r'''function couponPaymentProvider(p){const n=String(p&&p.n||'');if(n==='PayPay')return'paypay';if(n==='Olive'||n==='Olive通常'||n.includes('三井住友カード'))return'vpass';return'';}
function couponStoreOffer(store,provider){
 const names=[store.store,...(store.aliases||[])].map(couponNorm).filter(Boolean);
 const offers=(COUPON_FEED.offers||[]).filter(o=>o.provider===provider);
 const exact=offers.filter(o=>names.includes(couponNorm(o.brand)));
 const pool=exact.length?exact:offers.filter(o=>{const b=couponNorm(o.brand);return b.length>=4&&names.some(n=>n.length>=4&&(n.includes(b)||b.includes(n)));});
 return pool.sort((a,b)=>(Number(b.rate)||0)-(Number(a.rate)||0))[0]||null;
}
function couponOfferFor(store,p){const provider=couponPaymentProvider(p);return provider?couponStoreOffer(store,provider):null;}
function refreshCouponBonus(store){
 store.payments=store.payments.filter(p=>p.id!=='vpassCouponCard');
 const vpass=couponStoreOffer(store,'vpass');
 if(vpass&&!store.payments.some(p=>couponPaymentProvider(p)==='vpass')){
  store.payments.push({...METHODS.card,id:'vpassCouponCard',n:'三井住友カード / Olive',r:'0.5%',x:'Vクーポン対象カード利用・通常還元0.5%設定',conditions:[...METHODS.card.conditions,'VクーポンをVpassで獲得後、対象カードで利用する場合。'],src:['sm'],rankable:true});
 }
 for(const p of store.payments){p.autoCouponRate=0;p.autoCoupon=null;const o=couponOfferFor(store,p);if(o){p.autoCouponRate=Math.max(0,Number(o.rate)||0);p.autoCoupon=o;}}
}
function comparisonRate'''

s2, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise SystemExit(f'coupon bridge block not found: {n}')

# Force a new browser cache-buster for the repaired client.
s2 = s2.replace('20260907-auto2', '20260907-auto3')
builder.write_text(s2, encoding='utf-8')

wf = Path('.github/workflows/coupon-auto.yml')
w = wf.read_text(encoding='utf-8').replace('20260907-auto2', '20260907-auto3')
wf.write_text(w, encoding='utf-8')
