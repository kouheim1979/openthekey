/* Additional stores requested 2026-09-11. */
(function () {
  'use strict';
  const a = window.PAYMENT_AUDIT_DATA;
  if (!a || !Array.isArray(a.rows)) throw new Error('基本店舗データがありません');
  const date = '2026-09-11';
  a.storeMeta = a.storeMeta || {};
  Object.assign(a.sources, {
    kkdGeneral: ['クリスピー・クリーム・ドーナツ：店頭予約商品の支払い案内', 'https://krispykreme.jp/menu/cat/doughnuts/'],
    kkdCode: ['クリスピー・クリーム・ドーナツ：2026年公式購入案内（PayPay・d払い・au PAY・カード）', 'https://krispykreme.jp/news/16007/'],
    kkdStores: ['クリスピー・クリーム・ドーナツ：公式店舗検索', 'https://krispykreme.jp/store-/'],
    fukufukuCamp: ['ふくふく：ブレッドキャンプふくふく公式店舗ページ', 'https://bakery-fukufuku.com/store/camp/'],
    fukufukuSaginuma: ['ふくふく：ブーランジェリーふくふく公式店舗ページ', 'https://bakery-fukufuku.com/store/boulangerie/'],
    fukufukuShibokuchi: ['ふくふく：レトロベーカリーふく福 子母口店公式ページ', 'https://bakery-fukufuku.com/store/retro/shibokuchi/'],
    fukufukuPayPay: ['ふくふく 子母口店：PayPay対応の店舗掲載情報', 'https://oishiimono.tokubai.co.jp/%E3%81%B5%E3%81%8F%E3%81%B5%E3%81%8F/258890'],
    fukufukuCurrent: ['ふくふく 鷺沼店：カード・電子マネー・QRコード決済可の現行店舗情報', 'https://tabelog.com/kanagawa/A1405/A140507/14070269/']
  });
  const text = value => {
    let i = a.text.indexOf(value);
    if (i < 0) { i = a.text.length; a.text.push(value); }
    return i;
  };
  const paymentIds = ['paypay', 'rakuten', 'dpay', 'aupay', 'famipay', 'aeonpay'];
  const paymentNames = {paypay:'PayPay',rakuten:'楽天ペイ',dpay:'d払い',aupay:'au PAY',famipay:'FamiPay',aeonpay:'AEON Pay'};
  function add(name, aliases, methods, sourceKeys, note, combination, options = {}) {
    if (a.rows.some(r => r[0] === name)) return;
    const pi = a.pay.push(methods.map(id => ({id}))) - 1;
    const qi = a.points.push([]) - 1;
    const checks = paymentIds.map(id => ({
      name: paymentNames[id],
      state: methods.includes(id)
        ? '確認済み（対応店舗・レジ・対象商品に限る）'
        : ((options.checks || {})[id] || '未確認（非対応とは断定しません）')
    }));
    a.rows.push([
      name, aliases, pi, qi, sourceKeys, [text(note)], [],
      text(options.status || '店舗・決済条件確認'),
      text(options.pointStatus || '提示ポイントは未確認'),
      options.scope || '店頭'
    ]);
    a.storeMeta[name] = {
      date,
      combination,
      checks,
      partial: options.partial !== false,
      aeonOwners: false,
      notice: options.notice || '',
      scopeHint: options.scopeHint || '支店・対象商品・決済方式は店頭表示もご確認ください。',
      conditions: options.conditions || [],
      matchRequired: '',
      excludeTerms: []
    };
  }

  add(
    'クリスピー・クリーム・ドーナツ',
    ['クリスピークリームドーナツ','クリスピークリーム','クリスピー','krispy kreme','KKD','アトレ川崎 クリスピークリーム','ららテラス武蔵小杉 クリスピークリーム'],
    ['paypay','dpay','aupay','card','cash'],
    ['kkdGeneral','kkdCode','kkdStores'],
    '公式の2026年購入案内でクレジットカード、PayPay、メルペイ、d払い、au PAYを確認。一般の店頭案内では現金・クレジットカード・電子マネー対応が案内されています。店舗・催事・施設レジにより取扱いが異なる場合があります。',
    '対応レジではPayPay 1.5%を基本比較。d払い・au PAYは通常0.5%、カードは保有カードの通常0.5%設定で比較します。楽天ペイ・FamiPay・AEON Payは今回の公式情報で確定できていないため順位に入れません。',
    {
      notice:'PayPay・d払い・au PAY・カードを確認／支店差あり',
      scopeHint:'クリスピー・クリーム・ドーナツの通常店舗を想定。催事・施設独自レジ・クイックオーダーは表示される決済方法を優先してください。',
      checks:{rakuten:'今回の公式確認では未掲載',famipay:'今回の公式確認では未掲載',aeonpay:'今回の公式確認では未掲載'},
      conditions:['メルペイは公式案内で利用可ですが、このチェッカーの比較対象Payには未登録のため順位表示していません。','電子マネーの種類は店舗ごとに異なるため、Suica等を一律で順位に追加していません。']
    }
  );

  add(
    'ふくふく（川崎）',
    ['ふくふく','ふく福','パン屋ふくふく','ベーカリーふくふく','ブーランジェリーふくふく','ブーランジェリー ふくふく 鷺沼店','ブレッドキャンプふくふく','ブレッドキャンプ ふくふく','レトロベーカリーふく福','レトロベーカリー ふく福 子母口店','ふくふく鷺沼','ふくふく子母口','ふくふく鹿島田'],
    ['paypay','card','cash'],
    ['fukufukuCamp','fukufukuSaginuma','fukufukuShibokuchi','fukufukuPayPay','fukufukuCurrent'],
    '川崎市内の「ふくふく」系列（鷺沼・子母口・鹿島田）を検索対象に追加。子母口店の店舗掲載情報でPayPay対応を確認し、現行の鷺沼店情報ではカード・電子マネー・QRコード決済可を確認しています。QRの個別ブランドは支店差があるため、PayPay以外は未確認扱いです。',
    '確認できた範囲ではPayPay 1.5%を優先。カードは通常0.5%設定で比較します。d払い・au PAY・楽天ペイ・FamiPay・AEON Payは「QR決済可」だけから対応と推測せず、店頭表示を確認してください。',
    {
      notice:'川崎のふくふく系列／PayPay確認・他QRは支店ごとに確認',
      scopeHint:'対象例：ブーランジェリーふくふく鷺沼店、レトロベーカリーふく福子母口店、ブレッドキャンプふくふく（鹿島田）。支店ごとのレジ表示を優先してください。',
      checks:{rakuten:'QRコード決済可の情報はあるがブランド未確認',dpay:'QRコード決済可の情報はあるがブランド未確認',aupay:'QRコード決済可の情報はあるがブランド未確認',famipay:'QRコード決済可の情報はあるがブランド未確認',aeonpay:'QRコード決済可の情報はあるがブランド未確認'},
      conditions:['2024年の子母口店掲載ではPayPayのみ明示、2026年の店舗情報ではカード・電子マネー・QRコード決済可の記載があります。支払い設備更新の可能性があるため、個別QRブランドは店頭優先です。']
    }
  );

  if (a.localUpdate) {
    a.localUpdate = {date, added:(Number(a.localUpdate.added) || 0) + 2, total:a.rows.length};
  } else {
    a.localUpdate = {date, added:2, total:a.rows.length};
  }
  if (a.paymentAudit) a.paymentAudit.total = a.rows.length;
  window.PAYMENT_LOCAL_READY = true;
})();
