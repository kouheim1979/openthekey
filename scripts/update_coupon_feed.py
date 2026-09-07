from pathlib import Path
from datetime import datetime, timezone, timedelta
import urllib.request, re, html, json

JST = timezone(timedelta(hours=9))
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36'
SOURCES = {
    'vpass': 'https://www.smbc-card.com/camp/vcoupon/index.jsp',
    'paypay': 'https://paypay.ne.jp/event/jumbo-coupon/',
}

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language':'ja,en;q=0.8'})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        enc = r.headers.get_content_charset() or 'utf-8'
    return raw.decode(enc, errors='ignore')

def text_lines(page):
    page = re.sub(r'<script\b[^>]*>.*?</script>', ' ', page, flags=re.I|re.S)
    page = re.sub(r'<style\b[^>]*>.*?</style>', ' ', page, flags=re.I|re.S)
    page = re.sub(r'<(?:br|/p|/div|/li|/h\d|/a)>', '\n', page, flags=re.I)
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
    s=re.sub(r'^(おすすめクーポン|今週のおすすめクーポン|クーポンを獲得する)$','',s).strip()
    return s

def parse_vpass(page):
    lines=text_lines(page); offers=[]
    for i,line in enumerate(lines):
        m=re.fullmatch(r'(\d+(?:\.\d+)?)％還元', line)
        if not m: continue
        brand=''
        for j in range(i-1,max(-1,i-6),-1):
            c=clean_brand(lines[j])
            if c and not re.search(r'％|獲得|クーポン|時点|おすすめ',c):
                brand=c;break
        if brand:
            offers.append({'provider':'vpass','brand':brand,'rate':float(m.group(1)),'sourceUrl':SOURCES['vpass'],'note':'Vクーポン公開掲載。獲得済み・対象カードであることが必要'})
    return offers

def parse_date_range(s, now):
    m=re.search(r'(\d{4})/(\d{1,2})/(\d{1,2})\s*[〜～-]\s*(?:(\d{4})/)?(\d{1,2})/(\d{1,2})',s)
    if not m:return None,None
    y1,mo1,d1=int(m.group(1)),int(m.group(2)),int(m.group(3));y2=int(m.group(4) or y1);mo2,d2=int(m.group(5)),int(m.group(6))
    return f'{y1:04d}-{mo1:02d}-{d1:02d}',f'{y2:04d}-{mo2:02d}-{d2:02d}'

def parse_money(s):
    m=re.search(r'([0-9,]+)円',s)
    return int(m.group(1).replace(',','')) if m else 0

def parse_paypay(page):
    lines=text_lines(page); offers=[]; now=datetime.now(JST).date()
    for i,line in enumerate(lines):
        m=re.fullmatch(r'最大\s*(\d+(?:\.\d+)?)％付与',line)
        if not m: continue
        brand=''
        for j in range(i-1,max(-1,i-7),-1):
            c=clean_brand(lines[j])
            if c and not re.search(r'％|付与|対象金額|上限|期間|クーポン|今週|月曜',c):
                brand=c;break
        if not brand: continue
        min_spend=max_bonus=0;start=end=None
        for k in range(i+1,min(len(lines),i+16)):
            t=lines[k]
            if '対象金額' in t and k+1<len(lines): min_spend=parse_money(t+' '+lines[k+1])
            if '付与上限' in t and k+1<len(lines): max_bonus=parse_money(t+' '+lines[k+1])
            if '開催期間' in t and k+1<len(lines): start,end=parse_date_range(t+' '+lines[k+1],now)
            if k>i+2 and re.fullmatch(r'最大\s*\d+(?:\.\d+)?％付与',t): break
        if end:
            try:
                e=datetime.strptime(end,'%Y-%m-%d').date()
                if e < now: continue
            except: pass
        offers.append({'provider':'paypay','brand':brand,'rate':float(m.group(1)),'minSpend':min_spend,'maxBonus':max_bonus,'start':start,'end':end,'sourceUrl':SOURCES['paypay'],'note':'PayPay公式公開クーポン。獲得済み・対象条件を満たすことが必要'})
    return offers

def dedupe(offers):
    out={}
    for o in offers:
        key=(o['provider'],re.sub(r'\s+','',o['brand']).lower())
        if key not in out or o.get('rate',0)>out[key].get('rate',0):out[key]=o
    return list(out.values())

errors=[];offers=[]
for provider,url in SOURCES.items():
    try:
        p=fetch(url)
        offers += parse_vpass(p) if provider=='vpass' else parse_paypay(p)
    except Exception as e:
        errors.append(f'{provider}: {e}')

data={'updatedAt':datetime.now(JST).isoformat(),'offers':dedupe(offers),'sources':SOURCES,'errors':errors}
Path('coupon-feed.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('offers',len(data['offers']),'errors',errors)
