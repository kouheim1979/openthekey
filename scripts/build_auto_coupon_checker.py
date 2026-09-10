from pathlib import Path
import hashlib,base64,re

VERSION='20260910-kohnan-seria1'
s=Path('checker-20260907.js').read_text(encoding='utf-8')
def replace(old,new):
    global s
    if old not in s: raise SystemExit('Missing build anchor: '+old[:100])
    s=s.replace(old,new,1)

replace('const AUDIT=window.PAYMENT_AUDIT_DATA;',"const AUDIT=window.PAYMENT_AUDIT_DATA;\nlet COUPON_FEED={offers:[],updatedAt:''};")
replace("function comparisonRate(payment){return configuredRate(payment.r)+(payment.ownerRate||0);}\nfunction comparisonLabel(payment){return payment.ownerRate?comparisonRate(payment).toFixed(1)+'%':payment.r;}",Path('scripts/coupon_runtime.js').read_text(encoding='utf-8'))
replace('function refreshStoreSummary(store){','function refreshStoreSummary(store){\n refreshCouponBonus(store);')
replace('function renderPayment(store,context=null){','function renderPayment(store,context=null){\n lastCouponContext=context;refreshStoreSummary(store);')
replace("</div>'+ownerControls(store)+'<div class=\"rank-grid\">","</div>'+ownerControls(store)+couponStrip(store)+'<div class=\"rank-grid\">")
replace("  const hint=p.ownerRate?'株主優待込み':", "  const hint=p.autoCouponRate?(p.autoCoupon.provider==='paypay'?'確認したクーポン込み':'クーポン条件付き'):p.ownerRate?'株主優待込み':")
replace("  const detail=p.ownerRate?'決済 '+p.r+' ＋ 株主優待 '+p.ownerRate.toFixed(1)+'%':p.x;", "  const detail=p.autoCoupon?couponDetail(p):p.ownerRate?'決済 '+p.r+' ＋ 株主優待 '+p.ownerRate.toFixed(1)+'%':p.x;")
replace(' show($("resultPanel"));', ' bindCouponControls(store,context);show($("resultPanel"));')
replace("function paymentLabel(payment){return payment.n+'（'+comparisonLabel(payment)","function paymentLabel(payment){return payment.n+'（'+comparisonLabel(payment)+(payment.autoCoupon?'・'+couponDetail(payment):'')")
replace('const total=configuredRate(best.r)+add;', 'const total=comparisonRate(best)+add;')
replace("best.n+' '+best.r+' ＝ 計'", "best.n+' '+comparisonLabel(best)+' ＝ 計'")
# Keep store-specific point restrictions; describe the selected coupon route separately.
replace(' store.combination=combinationFor(store);'," store.combination=combinationFor(store);\n if(top[0]&&top[0].autoCoupon)store.combination=couponDetail(top[0])+'。 '+store.combination;")
replace('期間限定キャンペーン・クーポン・チャージ元特典は自動加算しません。','公開Vクーポンは対象条件付きの比較。PayPayは公式公開の会員向け候補を自動取得し、今回使えると確認したものだけ上限を反映して比較。一般向け・Myクーポン・獲得状態は未取得。その他のキャンペーン・チャージ特典は自動加算しません。')
replace('window.PAYMENT_CHECKER_READY=true;',"window.PAYMENT_CHECKER_READY=true;loadPublicCoupons();\n window.addEventListener('pageshow',e=>{if(e.persisted)loadPublicCoupons();});")
out=Path('checker-20260907-autocoupons.js');out.write_text(s,encoding='utf-8')
integrity='sha384-'+base64.b64encode(hashlib.sha384(out.read_bytes()).digest()).decode()
for name in ['index.html','app-v2.html','app-v3.html']:
    p=Path(name);h=p.read_text(encoding='utf-8')
    h=re.sub(r'checker-20260907(?:-coupons|-autocoupons)?\.js\?v=[^\"\']+',f'checker-20260907-autocoupons.js?v={VERSION}',h)
    h=re.sub(r'(checker-20260907-autocoupons\.js\?v='+VERSION+r'\" integrity=\")[^\"]+(\")',lambda m:m[1]+integrity+m[2],h)
    h=re.sub(r'data-ui-version="[^"]+"',f'data-ui-version="{VERSION}"',h)
    p.write_text(h,encoding='utf-8')
print(VERSION,integrity)
