from paypay_public import parse_super,parse_lyp,active
import unittest
STAMP='2026-09-07T21:54:30+09:00'
class PublicCouponTests(unittest.TestCase):
    def card(self,cid='100372178',rate=10):
        return f'<li class="couponList__item">最大{rate}％付与<img class="logo__image" alt="ベルク"><a class="couponList__link" href="paypay://internalembed?url=https://www.paypay.ne.jp/portal/coupon-corner/coupons/{cid}">確認</a></li>'
    def test_super(self):
        o=parse_super(self.card(),STAMP)[0]
        self.assertEqual(o['audience'],'softbank');self.assertIsNone(o['acquired'])
        self.assertEqual(o['maxBonus'],100);self.assertEqual(o['end'],'2026-09-30')
    def test_new_id_unknown(self):
        self.assertFalse(parse_super(self.card(cid='999999'),STAMP)[0]['termsVerified'])
    def test_changed_rate_unknown(self):
        self.assertFalse(parse_super(self.card(rate=30),STAMP)[0]['termsVerified'])
    def test_not_empty_success(self):
        with self.assertRaises(ValueError):parse_super('<html>unavailable</html>',STAMP)
    def test_lyp_current_only(self):
        doc='<div class="sumdetail">対象期間：2026/9/1~2026/9/30 付与上限：100円相当/回 付与率：5％ 利用回数：1回/期間</div><div id="coupon__listitems"><div class="coupon__listitems--item"><p class="itemdetail__name">なか卯</p></div></div><div><p class="itemdetail__name">未来の店</p></div>'
        offers=parse_lyp(doc,STAMP);self.assertEqual(len(offers),1);self.assertEqual(offers[0]['brand'],'なか卯')
        self.assertTrue(active(offers[0],'2026-09-07'));self.assertFalse(active(offers[0],'2026-10-01'))
    def test_lyp_missing_current_list(self):
        with self.assertRaises(ValueError):parse_lyp('<html>future advertisement only</html>',STAMP)
if __name__=='__main__':unittest.main()
