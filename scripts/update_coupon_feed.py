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
    # Preserve distinct membership, date, and app-route offers; never collapse them by brand.
    unique={o.get('id') or (o['provider']+'|'+o['brand']):o for o in offers}
    data={'version':2,'updatedAt':checked,'offers':list(unique.values()),'sources':SOURCES,
          'sourceStatus':status,'errors':errors,
          'coverage':{'paypay':'公式公開のソフトバンク・LYP会員向け一覧のみ。一般向け一覧・個別配信・Myクーポン・獲得状態・利用済み枠は未取得。',
                      'bounds':'LYPの期間・上限は公開ページから取得。ソフトバンクの上限・期間は公式月次PDFの確認値をクーポンIDで照合。新IDの不明条件は推測しない。'}}
    dest.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print('offers',len(data['offers']),'errors',errors)
    if len(errors)==len(SOURCES): raise SystemExit('Every official coupon source failed')

if __name__=='__main__': main()
