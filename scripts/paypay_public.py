"""Anonymous official public coupon catalogues; never access My Coupons or claim APIs."""
from datetime import datetime, timezone, timedelta
from hashlib import sha256
import re
from bs4 import BeautifulSoup

JST = timezone(timedelta(hours=9))
SUPER_URL = 'https://paypay.ne.jp/event/super-paypay-coupon/'
LYP_URL = 'https://premium.yahoo.co.jp/benefit/coupon/paypay'
PDF_URL = 'https://www.softbank.jp/mobile/set/data/info/personal/news/service/20260824a/pdf/targetstores_aug_20260824.pdf'
# Bounds checked against the official monthly PDF on 2026-09-07 (pp.1-2).
# Key by coupon ID, not brand/month: a new coupon is NOT assigned an old cap or expiry.
# Rate and existence are always fetched from the current public catalogue.
SUPER_BOUNDS = {
 '100372197': ('セブン-イレブン',10,100,'transaction',1,'2026-09-01','2026-09-30','セブン-イレブンアプリ決済限定'),
 '100372196': ('セブン-イレブン',5,50,'transaction',1,'2026-09-01','2026-09-30','店頭PayPay決済'),
 '100372212': ('ジョイマート',10,150,'transaction',1,'2026-09-01','2026-09-30','対象ブランド・店舗のみ'),
 '100372211': ('西松屋チェーン',10,100,'transaction',1,'2026-09-01','2026-09-30','店頭のみ・一部店舗対象外'),
 '100372178': ('ベルク',10,100,'transaction',1,'2026-09-01','2026-09-30','店頭・たばこ除外'),
 '100372210': ('ミニストップ',10,100,'transaction',1,'2026-09-01','2026-09-30','ミニストップアプリ決済限定'),
 '100372208': ('ミニストップ',5,50,'transaction',1,'2026-09-01','2026-09-30','店頭PayPay決済'),
 '100372170': ('Yahoo!ショッピング',10,300,'period',None,'2026-09-01','2026-09-30','ログイン・対象オンライン注文のみ'),
 '100372169': ('DiDi',10,200,'period',None,'2026-09-01','2026-09-30','DiDiアプリ決済限定'),
 '100372134': ('Qoo10',10,300,'transaction',1,'2026-08-28','2026-09-09','対象オンライン決済'),
 '100372135': ('ebookjapan',9,100,'period',None,'2026-09-01','2026-09-30','対象オンライン決済'),
}
ALIASES = {'西松屋チェーン':['西松屋'], 'キッチンオリジン・オリジン弁当':['キッチンオリジン','オリジン弁当']}

def text(node):
    return node.get_text(' ', strip=True) if node else ''

def base_offer(brand, audience, source, checked):
    return dict(provider='paypay',brand=brand,aliases=ALIASES.get(brand,[]),audience=audience,
                sourceUrl=source,checkedAt=checked,acquired=None,minSpend=None,
                note='事前獲得・対象店舗・商品・決済方法・残り利用枠はPayPayで確認。早期終了の場合あり。')

def parse_super(page, checked):
    soup=BeautifulSoup(page,'html.parser');offers=[]
    for item in soup.select('.couponList__item'):
        logo=item.select_one('img.logo__image');link=item.select_one('a.couponList__link[href]')
        rate=re.search(r'(\d+(?:\.\d+)?)\s*[％%]',text(item))
        if not logo or not link or not rate: continue
        title=logo.get('alt','').strip();brand=re.split(r'[（(]',title)[0].strip()
        cm=re.search(r'/coupons/(\d+)',link['href'])
        if not brand or not cm: continue
        cid=cm.group(1);o=base_offer(brand,'softbank',SUPER_URL,checked)
        o.update(id='paypay-'+cid,couponId=cid,title=title,rate=float(rate.group(1)),
                 openUrl='paypay://internalembed?url=https://www.paypay.ne.jp/portal/coupon-corner/coupons/'+cid,
                 requirements='ソフトバンク限定・スマートログインとYahoo! JAPAN IDのPayPay連携が必要。ワイモバイル・LINEMO等は対象外。',
                 paymentRoute=text(item.select_one('.logo__note')),termsVerified=False)
        bounds=SUPER_BOUNDS.get(cid)
        if bounds and bounds[0]==brand and bounds[1]==o['rate']:
            _,_,cap,cap_scope,uses,start,end,route=bounds
            o.update(maxBonus=cap,capScope=cap_scope,maxUses=uses,start=start,end=end,
                     paymentRoute=route,termsVerified=True,termsSourceUrl=PDF_URL,
                     termsCheckedAt='2026-09-07',termsMethod='official-monthly-PDF-checked-by-coupon-ID')
        offers.append(o)
    if not offers: raise ValueError('current SoftBank coupon cards were not found; not an empty-coupon result')
    return offers

def parse_lyp(page, checked):
    soup=BeautifulSoup(page,'html.parser');summary=text(soup.select_one('.sumdetail'))
    dates=re.search(r'(\d{4}/\d{1,2}/\d{1,2})\s*[~〜～]\s*(\d{4}/\d{1,2}/\d{1,2})',summary)
    rate=re.search(r'付与率[：:]\s*(\d+(?:\.\d+)?)\s*[％%]',summary)
    cap=re.search(r'付与上限[：:]\s*([\d,]+)円相当\s*/\s*回',summary)
    uses=re.search(r'利用回数[：:]\s*(\d+)回\s*/\s*期間',summary)
    if not all((dates,rate,cap,uses)): raise ValueError('LYP current-period conditions unavailable')
    start,end=[datetime.strptime(d,'%Y/%m/%d').date().isoformat() for d in dates.groups()]
    offers=[]
    for item in soup.select('#coupon__listitems .coupon__listitems--item'):
        brand=text(item.select_one('.itemdetail__name'))
        if not brand: continue
        o=base_offer(brand,'lyp',LYP_URL,checked)
        o.update(id='lyp-'+start+'-'+sha256(brand.encode()).hexdigest()[:12],title=brand,
                 start=start,end=end,rate=float(rate.group(1)),maxBonus=int(cap.group(1).replace(',','')),
                 capScope='transaction',maxUses=int(uses.group(1)),termsVerified=True,termsSourceUrl=LYP_URL,
                 paymentRoute='対象店舗・決済のみ',requirements='LYPプレミアム対象プランとYahoo! JAPAN IDのPayPay連携が必要。LINEMOは対象外。')
        # Do not infer group-member chains or transfer online coupons to in-store payments.
        if brand=='松弁ネット':
            o['aliases']=['松弁ネット/松屋モバイルオーダー'];o['paymentRoute']='松弁ネット限定・松屋店頭は対象外'
        elif brand=='松屋フーズ':
            o['paymentRoute']='対象店頭のみ・松弁ネット/モバイルオーダー等対象外'
        elif brand=='ワッツグループ':
            o['paymentRoute']='店頭のみ・ワッツオンライン対象外'
        offers.append(o)
    if not offers: raise ValueError('LYP current merchant list did not render; future-month advertisements are not substituted')
    return offers

def active(offer,today):
    return (not offer.get('start') or offer['start']<=today) and (not offer.get('end') or today<=offer['end'])
