from pathlib import Path
from datetime import datetime, timezone, timedelta
import urllib.request, re, html, json, subprocess, shutil

JST = timezone(timedelta(hours=9))
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36'
SOURCES = {
    'vpass': 'https://www.smbc-card.com/camp/vcoupon/index.jsp',
    'paypay': 'https://paypay.ne.jp/event/jumbo-coupon/',
}

def fetch(url):
    # Official coupon pages render their lists with JavaScript. On GitHub-hosted
    # Linux runners, use installed Chrome/Chromium to render the DOM first.
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

def parse_date_range(s, now):
    m=re.search(r'(\d{4})[/.](\d{1,2})[/.](\d{1,2})\s*[〜～~-]\s*(?:(\d{4})[/.])?(\d{1,2})[/.](\d{1,2})',s)
    if not m:return None,None
    y1,mo1,d1=int(m.group(1)),int(m.group(2)),int(m.group(3));y2=int(m.group(4) or y1);mo2,d2=int(m.group(5)),int(m.group(6))
    return f'{y1:04d}-{mo1:02d}-{d1:02d}',f'{y2:04d}-{mo2:02d}-{d2:02d}'

def parse_money(s):
    m=re.search(r'([0-9,]+)\s*円',s)
    return int(m.group(1).replace(',','')) if m else 0

def parse_paypay(page):
    lines=text_lines(page); offers=[]; now=datetime.now(JST).date()
    for i,line in enumerate(lines):
        m=re.search(r'最大\s*(\d+(?:\.\d+)?)\s*[％%]\s*付与',line)
        if not m: continue
        brand=''
        for j in range(i-1,max(-1,i-9),-1):
            c=clean_brand(lines[j])
            if c and len(c)<=80 and not re.search(r'[％%]|付与|対象金額|上限|期間|クーポン|今週|月曜',c):
                brand=c;break
        if not brand: continue
        min_spend=max_bonus=0;start=end=None
        for k in range(i+1,min(len(lines),i+20)):
            t=lines[k]
            if '対象金額' in t:
                min_spend=parse_money(' '.join(lines[k:min(len(lines),k+3)]))
            if '付与上限' in t:
                max_bonus=parse_money(' '.join(lines[k:min(len(lines),k+3)]))
            if '開催期間' in t:
                start,end=parse_date_range(' '.join(lines[k:min(len(lines),k+3)]),now)
            if k>i+2 and re.search(r'最大\s*\d+(?:\.\d+)?\s*[％%]\s*付与',t): break
        if end:
            try:
                if datetime.strptime(end,'%Y-%m-%d').date() < now: continue
            except Exception: pass
        offers.append({'provider':'paypay','brand':brand,'rate':float(m.group(1)),'minSpend':min_spend,'maxBonus':max_bonus,'start':start,'end':end,'sourceUrl':SOURCES['paypay'],'note':'PayPay公式公開クーポン。獲得済み・対象条件を満たすことが必要'})
    return offers

def dedupe(offers):
    out={}
    for o in offers:
        brand=re.sub(r'\s+','',o['brand']).lower()
        if not brand or len(brand)>80: continue
        key=(o['provider'],brand)
        if key not in out or o.get('rate',0)>out[key].get('rate',0):out[key]=o
    return list(out.values())

errors=[];offers=[]
for provider,url in SOURCES.items():
    try:
        page=fetch(url)
        parsed=parse_vpass(page) if provider=='vpass' else parse_paypay(page)
        offers += parsed
        print(provider,'parsed',len(parsed))
    except Exception as e:
        errors.append(f'{provider}: {e}')

data={'updatedAt':datetime.now(JST).isoformat(),'offers':dedupe(offers),'sources':SOURCES,'errors':errors}
Path('coupon-feed.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('offers',len(data['offers']),'errors',errors)
