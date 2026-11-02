/* 2026-11-02 (JST) rate audit.
 * Personal comparison values (settings.mufg/olive/smbc/paypay) are the owner's choice and are NOT
 * replaced here. This file records the official base/conditional rates beside them, dated expiries of
 * store-level programmes, and the sources used. Items that could not be confirmed stay "要確認".
 */
(function () {
  'use strict';
  const a = window.PAYMENT_AUDIT_DATA;
  if (!a || !Array.isArray(a.rows) || !window.PAYMENT_LOCAL_READY) throw new Error('基本店舗データがありません');
  const checked = '2026-11-02';
  const text = value => { let i = a.text.indexOf(value); if (i < 0) i = a.text.push(value) - 1; return i; };
  Object.assign(a.sources, {
    smbc202602: ['三井住友カード：2026年2月1日のVポイントサービス拡充（Olive 8%・アプリログイン特典終了）（2026-11-02確認）', 'https://www.smbc-card.com/company/news/25/news0002115.pdf'],
    smbcStores: ['三井住友カード：対象のコンビニ・飲食店で最大8%還元（2026-11-02確認）', 'https://www.smbc-card.com/nyukai/merit/proper_p5.jsp'],
    mufgFaq: ['三菱UFJニコス：7%還元の対象店舗（国際ブランド別）（2026-11-02確認）', 'https://faq.cr.mufg.jp/mufgcard/detail?id=4269'],
    mufg20261013: ['三菱UFJニコス：2026年12月16日利用分からの対象店舗改定（AmEx拡大・ドミー終了・スシロー持ち帰りネット注文）（2026-11-02確認）', 'https://www.cr.mufg.jp/member/new/20261013_01.html'],
    pp202606: ['PayPay：2026年6月2日のPayPayステップ改定（本人確認必須）（2026-11-02確認）', 'https://paypay.ne.jp/uploads/2026/04/pdf_notice_20260406_paypaystep.pdf'],
    rp202601: ['報道：楽天ペイの楽天キャッシュ還元条件の変更見合わせ（2026年1月・新時期未定）（2026-11-02確認・公式原文は要確認）', 'https://k-tai.watch.impress.co.jp/docs/news/2078356.html']
  });
  // Shown next to each personal comparison value. These are not used for ranking.
  // base: official numeric rate at target stores, used only for the short label (never for ranking).
  a.officialRates = {
    checked,
    olive: {base: 8, short: '公式8%', text: '公式：対象店のOliveクレジットモード（スマホタッチ等）8%。条件達成で最大20%', src: 'smbc202602'},
    smbc: {base: 7, short: '公式7%', text: '公式：対象店のスマホタッチ等7%。条件達成で最大20%', src: 'smbcStores'},
    mufg: {base: 7, short: '公式7%・条件で最大20%', text: '公式：対象店7%。三菱UFJ銀行の口座設定・エントリー等で最大20%（対象店合計で月5万円まで）', src: 'mufgFaq'},
    paypay: {short: '公式0.5〜1.0%＋ステップ', text: '公式基本：残高0.5%／PayPayクレジット1.0%。ステップ達成で+0.5%（本人確認必須）', src: 'pp202606'},
    rakuten: {short: '未達時1.0%', text: '公式：楽天キャッシュ払いは条件達成1.5%・未達1.0%。2026年1月発表の引き下げ（最大1.0%・提示5回）は見合わせ中で新時期未定のため要確認', src: 'rp202601'}
  };
  function note(name, message, sourceKeys, meta = {}) {
    const r = a.rows.find(row => row[0] === name);
    if (!r) throw new Error('監査対象の店舗がありません：' + name);
    r[4] = Array.from(new Set([...r[4], ...sourceKeys]));
    r[5] = [...r[5], text(checked + '確認：' + message)];
    const current = a.storeMeta[name] || (a.storeMeta[name] = {});
    Object.assign(current, {date: checked, conditions: [...(current.conditions || []), message]}, meta);
  }
  // Official notice 2026-10-13: ドミー leaves the programme for use on/after 2026-12-16 (some branches earlier).
  note('ドミー', '三菱UFJカードのポイント優遇は2026年12月15日利用分まで（12月16日以降は対象外。一部店舗はそれより前に終了する場合あり）。終了後は自動的に順位から外します。',
    ['mufg20261013'], {paymentUntil: {mufg: '2026-12-15'}});
  note('スシロー', '三菱UFJカード：2026年12月16日利用分から「お持ち帰りネット注文」も優遇対象（スシローデリバリーは対象外）。それまでは店舗払いのみで比較します。',
    ['mufg20261013']);
  // List the dated rate sources on every store that shows the corresponding payment.
  const sourceByPayment = {olive: ['smbc202602'], oliveStar: ['smbc202602'], smbc: ['smbcStores'], smbcStar: ['smbcStores'],
    mufg: ['mufgFaq', 'mufg20261013'], mufgOnline: ['mufgFaq'], mufgRecurring: ['mufgFaq'], mufgStar: ['mufgFaq'], mufgCoke: ['mufgFaq'],
    paypay: ['pp202606'], paypayCoke: ['pp202606'], rakuten: ['rp202601']};
  for (const r of a.rows) {
    const keys = a.pay[r[2]].flatMap(p => sourceByPayment[p.id] || []);
    if (keys.length) r[4] = Array.from(new Set([...r[4], ...keys]));
  }
  a.rateAudit = {date: checked, personalRatesKept: true, expiries: [{store: 'ドミー', payment: 'mufg', until: '2026-12-15'}]};
  window.PAYMENT_RATES_READY = true;
})();
