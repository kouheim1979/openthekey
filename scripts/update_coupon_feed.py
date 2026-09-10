from pathlib import Path
from datetime import datetime, timezone, timedelta
import urllib.request, re, html, json, subprocess, shutil
from paypay_public import parse_super, parse_lyp, active

JST = timezone(timedelta(hours=9))
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36'
SOURCES = {
    'vpass': 'https://www.smbc-card.com/camp/vcoupon/index.jsp',
    'paypay-softbank': 'https://paypay.ne.jp/event/super-paypay-coupon/',
    'paypay-lyp': 'https://premium.yahoo.co.jp/benefit/coupon/paypay',
}
MAJOR_SOURCES = {
    'rakuten': 'https://pay.rakuten.co.jp/campaign/',
    'dpay': 'https://service.smt.docomo.ne.jp/keitai_payment/info/campaign.html',
    'aupay': 'https://media.aupay.wallet.auone.jp/articles/5207',
    'aeonpay': 'https://www.aeon.co.jp/benefits/',
    'famipay': 'https://famipay.famidigi.jp/campaign/',
}

def fetch(url):
    chrome = shutil.which('google-chrome') or shutil.which('google-chrome-stable') or shutil.which('chromium') or shutil.which('chromium-browser')
    if chrome:
        cp = subprocess.run([
            chrome,'--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
            '--hide-scrollbars','--window-size=1280,4000','--virtual-time-budget=12000','--dump-dom',url
        ],capture_output=True,text=True,timeout=45)
        if cp.returncode == 0 and len(cp.stdout) > 1000:
            return cp.stdout
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language':'ja,en;q=0.8'})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        enc = r.headers.get_content_charset() or 'utf-8'
    return raw.decode(enc, errors='ignore')

def text_lines(page):
    page = re.sub(r'<script\b[^>]*>.*?</script>', ' ', page, flags=re.I|re.S)
    page = re.sub(r'<style\b[^>]*>.*?</style>', ' ', page, flags=re.I|re.S)
    page = re.sub(r'<(?:br\b[^>]*|/p|/div|/li|/h\d|/a|/section|/article)>', '\n', page, flags=re.I)
    page = re.sub(r'<[^>]+>', ' ', page)
    page = html.unescape(page)
    lines=[]
    for x in page.splitlines():
        x=re.sub(r'\s+',' ',x).strip()
        if x: lines.append(x)
    return lines

def clean_brand(s):
    s=re.sub(r'^(Image:?\s*)','',s,flags=re.I)
    s=re.sub(r'ロゴイメージ$','',s).strip()
    s=re.sub(r'^(おすすめクーポン|今週のおすすめクーポン|クーポンを獲得する|獲得)$','',s).strip()
    return s

def parse_vpass(page):
    lines=text_lines(page); offers=[]
    for i,line in enumerate(lines):
        m=re.search(r'(?<!\d)(\d+(?:\.\d+)?)\s*[％%]\s*還元', line)
        if not m: continue
        brand=''
        for j in range(i-1,max(-1,i-8),-1):
            c=clean_brand(lines[j])
            if c and len(c)<=80 and not re.search(r'[％%]|獲得|クーポン|時点|おすすめ|還元',c):
                brand=c;break
        if brand:
            offers.append({'provider':'vpass','brand':brand,'rate':float(m.group(1)),'sourceUrl':SOURCES['vpass'],'note':'Vクーポン公開掲載。獲得済み・対象カードであることが必要'})
    return offers

def fetch_raw(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept-Language':'ja'})
    with urllib.request.urlopen(req,timeout=25) as response:
        return response.read().decode('utf-8',errors='replace')

def render_lyp(url):
    from playwright.sync_api import sync_playwright
    chrome=shutil.which('google-chrome') or shutil.which('google-chrome-stable') or shutil.which('chromium')
    if not chrome: raise RuntimeError('Chrome is required to read the public LYP catalogue')
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=chrome,headless=True,args=['--no-sandbox'])
        try:
            page=browser.new_page(locale='ja-JP')
            page.goto(url,wait_until='domcontentloaded',timeout=30000)
            page.wait_for_selector('#coupon__listitems .itemdetail__name',timeout=20000)
            return page.content()
        finally: browser.close()

def current_major_offers(checked, today):
    """Verified public campaigns that need structured terms to rank safely.
    Lottery/cumulative campaigns are deliberately display-only.
    """
    offers=[]

    def add(**o):
        o.setdefault('checkedAt', checked)
        o.setdefault('feedSource', 'major-verified')
        o.setdefault('termsVerified', True)
        o.setdefault('rankable', True)
        offers.append(o)

    add(
        id='dpay-cokeon-first-202609', provider='dpay', brand='コカ・コーラ自販機',
        aliases=['Coke ON','コークオン','Coke ON自販機'], rate=50.0, minSpend=100,
        start='2026-09-01', end='2026-11-30', maxUses=1, capScope='期間中の初回購入',
        sourceUrl='https://service.smt.docomo.ne.jp/keitai_payment/campaign/dpay_coke-on_260901_7748/',
        title='Coke ON Pay はじめてd払い +50%',
        paymentRoute='Coke ON Payでd払い・100円以上の初回購入',
        requirements='要エントリー。2026年8月31日以前にCoke ON Payでd払い利用がなく、エントリーと初回購入が同月であること。'
    )
    add(
        id='dpay-charge-lottery-202609', provider='dpay', brand='*', paymentIds=['dpay'],
        start='2026-09-01', end='2026-09-30', rankable=False, termsVerified=False,
        sourceUrl='https://service.smt.docomo.ne.jp/keitai_payment/info/campaign.html',
        title='d払い残高へチャージ＆お買物 抽選キャンペーン',
        requirements='抽選・チャージ条件を含むため期待値を還元率に換算せず、表示だけ行います。'
    )
    add(
        id='dpay-sugi-goon-202609', provider='dpay', brand='スギ薬局',
        aliases=['スギドラッグ','ジャパン','ドラッグスギ'], rate=30.0,
        start='2026-09-01', end='2026-10-31', rankable=False, termsVerified=False,
        sourceUrl='https://service.smt.docomo.ne.jp/keitai_payment/info/campaign.html',
        title='対象GOO.N商品 累計購入で最大+30%',
        requirements='対象商品・累計6,000円/8,000円など段階条件があるため、1回の会計の還元率ランキングには自動加算しません。'
    )

    for brand in ['上島珈琲店','UCC Cafe Plaza','Cafe Lounge Gate 53']:
        add(
            id='aupay-ucc-202609-'+re.sub(r'\W+','',brand), provider='aupay', brand=brand,
            fixedBonus=100, bonusKind='discount', minSpend=700, maxBonus=100,
            start='2026-09-01', end='2026-09-30', maxUses=1, capScope='au ID',
            sourceUrl='https://media.aupay.wallet.auone.jp/articles/5226',
            title='UCCグループ 100円割引クーポン',
            paymentRoute='au PAY（コード支払い）',
            requirements='事前にau PAYアプリでクーポン獲得。対象店舗・対象外店舗・未使用であることを確認。'
        )
    add(
        id='aupay-haruyama-202609', provider='aupay', brand='はるやま', rate=10.0,
        minSpend=3000, maxBonus=1000, start='2026-09-04', end='2026-09-27',
        capScope='回・期間', sourceUrl='https://media.aupay.wallet.auone.jp/articles/5227',
        title='はるやま 最大+10%',
        paymentRoute='対象店舗でau PAY（コード支払い）',
        requirements='対象店舗のポスターを確認。一部店舗・商品は対象外。キャンペーン10%はベース0.5%を含みません。'
    )
    bic_periods=[
        ('1','2026-09-04','2026-09-07'),
        ('2','2026-09-11','2026-09-14'),
        ('3','2026-09-18','2026-09-24'),
        ('4','2026-09-25','2026-09-28'),
    ]
    for no,start,end in bic_periods:
        add(
            id='aupay-biccamera-202609-'+no, provider='aupay', brand='ビックカメラ',
            aliases=['BicCamera'], fixedBonus=1000, bonusKind='discount', minSpend=10000,
            maxBonus=1000, maxUses=1, capScope='各利用期間', start=start, end=end,
            sourceUrl='https://media.aupay.wallet.auone.jp/articles/5243',
            title='ビックカメラ対象店舗 1,000円割引クーポン',
            paymentRoute='対象店舗でau PAY（コード支払い）',
            requirements='期間ごとに対象店舗が異なります。利用店舗がその期間の対象で、事前獲得済み・未使用のクーポンであることを確認。'
        )
    add(
        id='aupay-superchance-202609', provider='aupay', brand='*', paymentIds=['aupay'],
        start='2026-09-01', end='2026-09-30', rankable=False, termsVerified=False,
        sourceUrl='https://media.aupay.wallet.auone.jp/articles/5207',
        title='街＋ネット利用の抽選「au PAY 超チャンス！」',
        requirements='抽選・複数チャネル合計条件のため、期待値を単純な還元率にせず表示だけ行います。'
    )

    rakuten_targets={
        'DAISO':['ダイソー','THREEPY','Standard Products'],
        '東京靴流通センター':['シュープラザ','靴チヨダ'],
        'ノジマ':[],'カインズ':[],'島忠ホームズ':[],'ハニーズ':[],
        '松屋':['松のや','マイカリー食堂'],'かっぱ寿司':[],
        '上島珈琲店':['UCC Cafe Plaza','Cafe Lounge Gate 53'],
        'B-Rサーティワンアイスクリーム':['サーティワン'],'鮨 酒 肴 杉玉':['杉玉']
    }
    for brand,aliases in rakuten_targets.items():
        add(
            provider='rakuten', brand=brand, aliases=aliases,
            start='2026-08-19', end='2026-09-23', rankable=False, termsVerified=False,
            sourceUrl='https://pay.rakuten.co.jp/campaign/2026/0819-kaimawari-chance/',
            title='わくわく買いまわりチャンス',
            requirements='要エントリー。店舗別の最低決済額でスタンプを集める抽選施策のため、還元率ランキングには加算しません。'
        )

    add(
        id='famipay-nextmonth-half-202609', provider='famipay', brand='*', paymentIds=['famipay'],
        rate=50.0, start='2026-09-01', end='2026-09-30', rankable=False, termsVerified=False,
        sourceUrl='https://famipay.famidigi.jp/cp/cp227/260901/',
        title='ファミペイ翌月払い 半額還元',
        requirements='要エントリー。翌月払いの合計利用額が対象。9月初回登録は上限3,000円相当、8月末までの登録済みは上限100円相当。通常残高払いと別ルートのため自動加算しません。'
    )

    aeon_brands=['イオン','イオンスタイル','まいばすけっと','ダイエー','イオンフードスタイル','グルメシティ','マックスバリュ','ピーコックストア','ビッグ・エー','ザ・ビッグ']
    day=int(today[-2:])
    if day == 10:
        for brand in aeon_brands:
            add(
                id='aeonpay-10x-'+today+'-'+brand, provider='aeonpay', brand=brand,
                paymentIds=['aeonGroup'], rate=4.0, start=today, end=today,
                sourceUrl='https://www.aeon.co.jp/benefits/',
                title='毎月10日 AEON Pay WAON POINT基本10倍',
                paymentRoute='対象店舗でAEON Payのスマホ決済',
                requirements='通常のイオングループ1.0%比較値に対する追加4.0%として、合計5.0%相当に補正。対象店舗・商品・支払方式を確認。'
            )
    if day in (20,30):
        for brand in aeon_brands:
            add(
                id='aeonpay-appreciation-'+today+'-'+brand, provider='aeonpay', brand=brand,
                paymentIds=['aeonGroup'], rate=5.0, bonusKind='discount', start=today, end=today,
                sourceUrl='https://www.aeon.co.jp/benefits/',
                title='お客さま感謝デー 5%OFF',
                paymentRoute='対象店舗・商品で対象のAEON Pay等',
                requirements='5%割引を比較用の値引き相当として加算。専門店・対象外商品・対象外支払方式は除外。'
            )

    return [o for o in offers if (not o.get('start') or today >= o['start']) and (not o.get('end') or today <= o['end'])]

def main():
    dest=Path('coupon-feed.json')
    try: previous=json.loads(dest.read_text(encoding='utf-8'))
    except (OSError,ValueError): previous={}
    checked=datetime.now(JST).isoformat();today=checked[:10]
    offers=[];errors=[];status={}
    for key,url in SOURCES.items():
        try:
            if key=='vpass':
                parsed=parse_vpass(fetch(url))
                if not parsed: raise ValueError('Vpass merchant list was not found')
                for o in parsed: o['checkedAt']=checked
            elif key=='paypay-softbank': parsed=parse_super(fetch_raw(url),checked)
            else: parsed=parse_lyp(render_lyp(url),checked)
            for o in parsed: o['feedSource']=key
            parsed=[o for o in parsed if active(o,today)]
            offers.extend(parsed);status[key]={'status':'ok','checkedAt':checked,'count':len(parsed)}
            print(key,'active',len(parsed))
        except Exception as e:
            errors.append(key+': '+str(e))
            retained=[]
            for original in previous.get('offers',[]):
                source=original.get('feedSource') or ('vpass' if original.get('provider')=='vpass' else '')
                if source!=key or not active(original,today): continue
                o=dict(original);o['checkedAt']=o.get('checkedAt') or previous.get('updatedAt','');o['feedSource']=key
                retained.append(o)
            offers.extend(retained);status[key]={'status':'failed','retainedCount':len(retained),'attemptedAt':checked}

    major=current_major_offers(checked,today)
    offers.extend(major)
    for provider in MAJOR_SOURCES:
        status['major-'+provider]={'status':'verified-structured-catalogue','checkedAt':checked,
                                  'count':sum(1 for o in major if o.get('provider')==provider)}
    unique={o.get('id') or (o['provider']+'|'+o['brand']+'|'+o.get('start','')+'|'+o.get('title','')):o for o in offers}
    data={
        'version':3,'updatedAt':checked,'offers':list(unique.values()),
        'sources':{**SOURCES,**MAJOR_SOURCES},'sourceStatus':status,'errors':errors,
        'coverage':{
            'paypay':'公式公開のソフトバンク・LYP会員向け一覧。一般向け一覧・個別配信・Myクーポン・獲得状態・利用済み枠は未取得。',
            'majorPay':'楽天ペイ・d払い・au PAY・AEON Pay・FamiPayは、公開情報から条件を安全に構造化できた施策を収録。定量化できるものだけ利用者確認後に順位へ反映し、抽選・累計条件・商品限定・別支払ルートは表示のみ。',
            'bounds':'期間・最低利用額・上限・対象ルートが確認できない施策は順位に使わない。対象支店、対象商品、エントリー、クーポン獲得、利用済み枠は利用時に確認する。'
        }
    }
    dest.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print('offers',len(data['offers']),'major',len(major),'errors',errors)
    if len(errors)==len(SOURCES): raise SystemExit('Every dynamic public coupon source failed')

if __name__=='__main__': main()
