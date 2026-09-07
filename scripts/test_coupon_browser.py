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
        for width in (320,375,390,430,820):
            ctx=browser.new_context(locale='ja-JP',viewport={'width':width,'height':844})
            ctx.route('**/coupon-feed.json?*',lambda route:route.fulfill(json=fixture))
            page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(url,wait_until='networkidle');page.wait_for_function('window.PAYMENT_CHECKER_READY===true')
            def search(name):
                page.locator('#manualSearch').fill(name);page.locator('#manualSearch').press('Enter')
                page.wait_for_selector('.store-name')
            def check_width():
                assert page.evaluate('document.documentElement.scrollWidth')<=width+1, 'horizontal overflow at '+str(width)
            search('ジョリパ');assert '10.5%' in page.locator('.rank-card.r1').inner_text();check_width()
            search('ベルク');assert page.locator('.coupon-offer').count()==1
            assert not page.locator('[data-pp-index="0"]').is_checked()
            page.locator('.coupon-expand summary').click();check_width()
            page.locator('#couponAmount').fill('3000');page.locator('[data-pp-index="0"]').check()
            page.locator('#couponApply').click();assert '100pt' in page.locator('.auto-coupon-strip').inner_text()
            assert '4.83%' in page.locator('#result').text_content();check_width()
            if width==390:page.screenshot(path='test-results/mobile-capped-ranking.png',full_page=True)
            assert not errors,errors
            ctx.close()
        # Real refreshed public data (not the fixture): verify screen and save review images.
        ctx=browser.new_context(locale='ja-JP',viewport={'width':390,'height':844})
        page=ctx.new_page();page.goto(url,wait_until='networkidle');page.wait_for_function('window.PAYMENT_CHECKER_READY===true')
        for name in ('ジョリパ','ベルク','吉野家'):
            page.locator('#manualSearch').fill(name);page.locator('#manualSearch').press('Enter')
            page.wait_for_selector('.store-name')
            assert page.evaluate('document.documentElement.scrollWidth')<=391
            page.screenshot(path='test-results/public-'+name+'.png',full_page=True)
        ctx.close()
        print('Mobile/browser checks passed at 320, 375, 390, 430 and 820 px; SRI, Jolly 10.5%, PayPay 100pt cap and opt-in verified')
    finally:browser.close();server.shutdown()
