from pathlib import Path
from datetime import datetime, timezone, timedelta
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import json,shutil
from playwright.sync_api import sync_playwright

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),QuietHandler)
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
now=datetime.now(timezone.utc)
fixture={'updatedAt':now.isoformat(),'offers':[
 {'provider':'vpass','brand':'ジョリーパスタ','rate':10,'sourceUrl':'https://www.smbc-card.com/camp/vcoupon/index.jsp'},
 {'provider':'paypay','brand':'ベルク','id':'test-belc','audience':'softbank','rate':10,'maxBonus':100,'capScope':'transaction','maxUses':1,
  'start':(now-timedelta(days=1)).date().isoformat(),'end':(now+timedelta(days=1)).date().isoformat(),'termsVerified':True,
  'sourceUrl':'https://paypay.ne.jp/event/super-paypay-coupon/','paymentRoute':'店頭・対象商品','requirements':'対象会員・獲得・未使用確認'}], 'errors':[]}
Path('test-results').mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
    try:
        # iPhone SE/mini/standard/Max portrait, landscape, and a tablet width.
        for width,height in ((320,568),(375,667),(390,844),(430,932),(667,375),(844,390),(820,1180)):
            ctx=browser.new_context(locale='ja-JP',viewport={'width':width,'height':height},is_mobile=width<700 or height<500,has_touch=True)
            ctx.route('**/coupon-feed.json?*',lambda route:route.fulfill(json=fixture))
            page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(url,wait_until='networkidle');page.wait_for_function('window.PAYMENT_CHECKER_READY===true')
            def search(name):
                page.locator('#manualSearch').fill(name);page.locator('#manualSearch').press('Enter')
                page.wait_for_selector('.store-name')
            def check_width():
                assert page.evaluate('document.documentElement.scrollWidth')<=width+1, 'horizontal overflow at '+str(width)
            assert page.locator('#status').inner_text()=='', page.locator('#status').inner_text()
            search('ジョリパ');r1=page.locator('.rank-card.r1').inner_text()
            # A public V coupon listing is not an acquired coupon: it must not be ranked by default.
            assert 'PayPay' in r1 and '10.5%' not in r1, r1
            if height>width:assert page.locator('.rank-card.r1').bounding_box()['y']<height*0.6,'best payment should be visible without scrolling'
            check_width()
            page.locator('.coupon-expand summary').click();page.locator('[data-coupon-vpass="1"]').check()
            page.locator('#couponApply').click();assert '10.5%' in page.locator('.rank-card.r1').inner_text();check_width()
            assert '本人設定値' not in page.locator('.rank-card.r1').inner_text()
            search('ローソン');assert '本人設定値（公式7%・条件で最大20%）' in page.locator('.rank-card.r1').inner_text();check_width()
            # UFJ 50,000-yen cap: the real select re-ranks the store (OK Club cash discount 2.9% then leads).
            search('オーケー');page.select_option('#mufgCap','used');assert 'OKクラブ' in page.locator('.rank-card.r1').inner_text()
            page.select_option('#mufgCap','open');assert '三菱UFJ' in page.locator('.rank-card.r1').inner_text();check_width()
            search('ベルク');assert page.locator('.coupon-offer').count()==1
            assert not page.locator('[data-coupon-key="test-belc"]').is_checked()
            page.locator('.coupon-expand summary').click();check_width()
            page.locator('#couponAmount').fill('3000');page.locator('[data-coupon-key="test-belc"]').check()
            page.locator('#couponApply').click();assert '100pt' in page.locator('.auto-coupon-strip').inner_text()
            assert '4.83%' in page.locator('#result').text_content();check_width()
            if width==390:page.screenshot(path='test-results/mobile-capped-ranking.png',full_page=True)
            if (width,height) in ((320,568),(667,375)):page.screenshot(path=f'test-results/iphone-{width}x{height}.png')
            assert not errors,errors
            ctx.close()
        ctx=browser.new_context(locale='ja-JP',viewport={'width':390,'height':844})
        page=ctx.new_page();page.goto(url,wait_until='networkidle');page.wait_for_function('window.PAYMENT_CHECKER_READY===true')
        for name in ('ジョリパ','ベルク','吉野家'):
            page.locator('#manualSearch').fill(name);page.locator('#manualSearch').press('Enter')
            page.wait_for_selector('.store-name')
            assert page.evaluate('document.documentElement.scrollWidth')<=391
            page.screenshot(path='test-results/public-'+name+'.png',full_page=True)
        ctx.close()
        print('Mobile/browser checks passed at 320x568, 375x667, 390x844, 430x932, 667x375, 844x390 and 820x1180; SRI, V coupon opt-in, official-rate labels, PayPay 100pt cap verified')
    finally:browser.close();server.shutdown()
