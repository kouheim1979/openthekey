/* Tressa Yokohama / LaLaport Yokohama additions. Verified 2026-09-13. */
(function(){
  'use strict';
  const a=window.PAYMENT_AUDIT_DATA;
  if(!a||!Array.isArray(a.rows)) throw new Error('基本店舗データがありません');
  a.storeMeta=a.storeMeta||{};
  Object.assign(a.sources,{
    tressaLakole:['トレッサ横浜：LAKOLE店舗ページ・支払い方法・ポイント','https://www.tressa-yokohama.jp/shop/index.jsp?bf=1&fmt=6&shopid=22322'],
    tressaPoint:['トレッサ横浜：トレッサポイント会員規約','https://www.tressa-yokohama.jp/shop/page.jsp?id=22'],
    andstPoint:['and ST：ポイントは1ポイント=1円','https://support.dot-st.com/hc/ja/articles/6112596610831-and-ST%E3%83%9D%E3%82%A4%E3%83%B3%E3%83%88%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9'],
    lalaportQr:['ららぽーと横浜：館内QR決済と対象外店舗','https://mitsui-shopping-park.com/lalaport/yokohama/info/2053400.html'],
    lalaportPoint:['三井ショッピングパークポイント：通常ポイント','https://mitsui-shopping-park.com/msppoint/point/'],
    lalaportExceptions:['ららぽーと横浜：ポイント・アプリde支払い対象外店舗','https://mitsui-shopping-park.com/lalaport/yokohama/info/1735008.html']
  });
  const text=v=>{let i=a.text.indexOf(v);if(i<0){i=a.text.length;a.text.push(v);}return i;};
  const paymentIds=['paypay','rakuten','dpay','aupay','famipay','aeonpay'];
  const paymentNames={paypay:'PayPay',rakuten:'楽天ペイ',dpay:'d払い',aupay:'au PAY',famipay:'FamiPay',aeonpay:'AEON Pay'};
  function add(name,aliases,methods,points,sourceKeys,note,combination,options={}){
    if(a.rows.some(r=>r[0]===name)) return;
    const pi=a.pay.push(methods.map(id=>({id})))-1;
    const qi=a.points.push(points)-1;
    const checks=paymentIds.map(id=>({name:paymentNames[id],state:methods.includes(id)?'確認済み（対象店・対象商品）':((options.checks||{})[id]||'未確認（非対応とは断定しません）')}));
    a.rows.push([name,aliases,pi,qi,sourceKeys,[text(note)],[],text(options.status||'店舗・決済条件確認'),text(options.pointStatus||(points.length?'提示条件は下記参照':'提示ポイントは未確認')),options.scope||'店頭']);
    a.storeMeta[name]={date:'2026-09-13',combination,checks,pointCaption:options.pointCaption,pointHeading:options.pointHeading,partial:!!options.partial,notice:options.notice||'',scopeHint:options.scopeHint||'支店・対象商品・決済方式は店頭表示もご確認ください。',conditions:options.conditions||[],matchRequired:options.matchRequired||'',excludeTerms:options.excludeTerms||[]};
  }
  add('LAKOLE トレッサ横浜店',['LAKOLE','ラコレ','ラコレ トレッサ横浜','LAKOLE トレッサ横浜','ラコレトレッサ'],['paypay','rakuten','dpay','aupay','card'],[
    {n:'and STポイント',r:'3.0%',x:'100円ごとに3P・1P=1円',base:3},
    {n:'トレッサポイント',r:'0.5%',x:'200円税込で1P・対象外商品等あり',base:0.5}
  ],['tressaLakole','tressaPoint','andstPoint'],
  'トレッサ横浜南棟2FのLAKOLE。公式店舗ページでクレジットカード、QUICPay、au PAY、d払い、PayPay、楽天ペイ、メルペイ、iD、交通系ICを確認。FamiPay・AEON Payは公式ページに記載がないため順位へ入れていません。',
  '条件を満たす場合、PayPay 1.5%＋and ST 3.0%＋トレッサポイント0.5%＝最大約5.0%目安。楽天ペイ1.5%も同率ですが、設定どおりPayPayを先に表示します。各ポイントの対象外商品・利用分・端数処理を確認してください。',
  {pointCaption:'and STとトレッサを別表示',conditions:['and STポイントは公式店舗ページで100円ごとに3ポイント。and STポイントは1P=1円。トレッサポイントは原則200円税込ごとに1Pで、商品・サービス・支払方法による対象外があります。'],checks:{famipay:'公式店舗ページに記載なし',aeonpay:'公式店舗ページに記載なし'},scopeHint:'トレッサ横浜店の条件です。他のLAKOLE店舗へ自動適用しません。'});
  add('トレッサ横浜',['TRESSA','Tressa Yokohama','トレッサ','トレッサ横浜南棟','トレッサ横浜北棟'],[],[
    {n:'トレッサポイント',r:'0.5%',x:'原則200円税込で1P・対象店のみ'}
  ],['tressaPoint'],
  '施設名だけでは支払い方法を一律に決められません。テナントごとに対応決済・独自ポイントが異なるため、LAKOLE、SANWA、Seriaなど実際の店名で検索してください。',
  'トレッサ横浜を選んだだけでは決済順位を出しません。実際に会計するテナント名を検索すると、その店の支払い方法を比較できます。',
  {status:'施設エントリ・テナント選択が必要',partial:true,pointCaption:'対象テナントのみ',notice:'店名まで選んでください',scopeHint:'トレッサポイントは原則200円税込で1P。対象外店舗・商品・サービス・支払方法があります。'});
  add('ららぽーと横浜',['LaLaport Yokohama','Lalaport Yokohama','ららぽーと','ララポート','ららぽーと横浜'],[],[
    {n:'三井ショッピングパークポイント',r:'税抜1〜2%',x:'通常1P/100円・対象カード/アプリde支払いは2P/100円'}
  ],['lalaportQr','lalaportPoint','lalaportExceptions'],
  '施設名だけでは支払い方法を一律に決められません。館内ではPayPay、楽天ペイ、d払い、au PAYなどを利用できる店舗が多い一方、全QR決済または一部サービスの対象外店舗があります。イトーヨーカドーと同専門店街も別扱いです。',
  'ららぽーと横浜を選んだだけでは決済順位を出しません。実際に買うテナント名を検索してください。三井ショッピングパークポイントも店舗・支払方法により対象外や付与差があります。',
  {status:'施設エントリ・テナント選択が必要',partial:true,pointCaption:'店舗・支払方法で異なる',notice:'店名まで選んでください',scopeHint:'一般のポイント対象店では100円税抜ごと1P、対象の三井ショッピングパークカード/アプリde支払いでは2Pが基本。対象外店舗があります。'});
  a.mallUpdate={date:'2026-09-13',added:['トレッサ横浜','LAKOLE トレッサ横浜店','ららぽーと横浜']};
  window.PAYMENT_MALLS_READY=true;
})();
