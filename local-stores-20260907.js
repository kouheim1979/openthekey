/* Local shopping additions. Existing brand audit dates are not overwritten. */
(function () {
  'use strict';
  const a = window.PAYMENT_AUDIT_DATA;
  if (!a || !Array.isArray(a.rows)) throw new Error('基本店舗データがありません');
  const date = '2026-09-07';
  const sources = {
    seriaLocal: ['セリア：モザイクモール港北店の公式支払い一覧', 'https://shop.seria-group.com/seria/info/000002036'],
    seriaSearch: ['セリア：店舗別の支払い方法を確認', 'https://shop.seria-group.com/seria/top'],
    seriaRakuten: ['楽天ペイ：コード・QR払いの還元対象外店舗（セリア掲載）', 'https://pay.rakuten.co.jp/topics/pointprogram/excluded-shops/'],
    maruetsuPay: ['マルエツ：支払い・提示ポイントの公式FAQ', 'https://www.maruetsu.co.jp/contact/faq/'],
    maruetsuPoint: ['マルエツ：WAON POINTの通常進呈と対象決済', 'https://www.maruetsu.co.jp/wp-content/uploads/2026/09/20260902_2.pdf'],
    maruetsuV: ['マルエツ：Vポイントサービス終了', 'https://www.maruetsu.co.jp/vpoint/'],
    aeonOwners: ['イオン：オーナーズカード返金率・利用上限', 'https://www.aeon.info/ir/stock/benefit/'],
    aeonOwnersPay: ['イオン：優待の対象支払い・対象外店舗', 'https://www.aeon.info/ir/stock/benefit/card/'],
    aeonOwnersFaq: ['イオン：AEON Payと優待の対象外条件', 'https://www.aeon.info/ir/stock/benefit/faq/'],
    aeonShop: ['AEON Pay：コード決済が使えるお店', 'https://www.aeon.co.jp/service/lp/aeonpay/shop/'],
    aeonRate: ['AEON Pay：通常のポイント', 'https://www.aeon.co.jp/service/lp/aeonpay/feature/'],
    aeonGroup: ['AEON Pay：200円で2ポイントの対象店・支払方式', 'https://faq.aeon.co.jp/faq/show/6781'],
    famiGeneral: ['FamiPay：バーコード・カード・QUICPayを区別', 'https://famipay.famidigi.jp/store/'],
    smartCode: ['JCB：Smart Code対応店（店舗例・除外あり）', 'https://www.smart-code.jp/shoplist/'],
    belcPay: ['ベルク：支払い方法一覧', 'https://www.belc.jp/service/cashless'],
    belcPoint: ['ベルクカード：支払い別ポイント', 'https://www.belc.jp/service/card'],
    belcMoney: ['ベルクペイ：現金チャージ特典の条件', 'https://pay.belc.jp/'],
    fitPoint: ['カメガヤ：ポイントと対象支払い', 'https://www.kamegaya.co.jp/point-emoney/index.html'],
    fitPay: ['カメガヤ・SCSK：QR決済導入（2019年の発表）', 'https://www.scsk.jp/news/2019/press/product/20190801.html'],
    fitD: ['ドコモ：Fit Care DEPOTのd払い', 'https://dpoint.docomo.ne.jp/static/store/208892/'],
    northPay: ['ノースポート：決済案内と対象外テナント', 'https://northport.jp/facility/detail/15'],
    northWaku: ['わくわく広場：ノースポート店', 'https://northport.jp/shop/detail/11129?tenant_cd=11129'],
    northKaldi: ['カルディ：ノースポート店', 'https://northport.jp/shop/detail/12175?tenant_cd=12175'],
    kaldiCard: ['カルディカード：チャージ特典・コーヒーポイント', 'https://member.kaldi.co.jp/'],
    hankyuLocal: ['都筑阪急：店舗公式サイト', 'https://website.hankyu-dept.co.jp/tsuzuki/'],
    hankyuPoints: ['都筑阪急：ポイントカードの案内', 'https://website.hankyu-dept.co.jp/tsuzuki/map/'],
    yorkLocal: ['ヨークフーズ港北店：決済ブランド', 'https://www.york-inc.com/store/kouhoku.html'],
    rosenPay: ['そうてつローゼン：対応決済とAEON Payの除外（6月案内）', 'https://www.sotetsu.rosen.co.jp/archives/45888'],
    rosenPoint: ['相鉄POINT：ポイントをためる', 'https://www.sotetsupoint.jp/append/'],
    kohnanPay: ['コーナン：使える支払方法', 'https://www.hc-kohnan.com/service/stores/payment/'],
    kohnanPoint: ['コーナン：楽天ポイントの進呈条件', 'https://pointcard.rakuten.co.jp/partner/kohnan/'],
    olympicPoint: ['Olympic：とこポン・対象支払い', 'https://www.olympic-corp.co.jp/tokopon-lp'],
    seijoLocal: ['成城石井：公式店舗の決済表示例', 'https://shop.seijoishii.com/seijoishii/spot/detail?code=0001'],
    aokiApp: ['AOKI：公式アプリのポイント案内', 'https://apps.apple.com/jp/app/aoki%E3%82%A2%E3%83%97%E3%83%AA/id876302243'],
    yodoApp: ['ヨドバシ：公式ポイントカードアプリ', 'https://www.yodobashi.com/ec/support/member/pointservice/gold/about/iphone/'],
    welciaPoint: ['ウエルシア：支払い・提示によるポイント', 'https://welcia.tayori.com/q/yk-01/detail/1225757/'],
    welciaBoth: ['ウエルシア：WAON POINTとVポイントの提示', 'https://welcia.tayori.com/q/yk-01/detail/682409/']
  };
  Object.assign(a.sources, sources);
  a.storeMeta = a.storeMeta || {};
  const text = value => { let i = a.text.indexOf(value); if (i < 0) { i = a.text.length; a.text.push(value); } return i; };
  const paymentIds = ['paypay', 'rakuten', 'dpay', 'aupay', 'famipay', 'aeonpay'];
  const paymentNames = {paypay:'PayPay',rakuten:'楽天ペイ',dpay:'d払い',aupay:'au PAY',famipay:'FamiPay',aeonpay:'AEON Pay'};
  function add(name, aliases, methods, points, sourceKeys, note, combination, options = {}) {
    if (a.rows.some(r => r[0] === name)) throw new Error('店舗の重複：' + name);
    const pi = a.pay.push(methods.map(id => ({id}))) - 1;
    const qi = a.points.push(points) - 1;
    const checks = paymentIds.map(id => {
      const ok = methods.includes(id) || (id === 'aeonpay' && methods.includes('aeonGroup'));
      return {name:paymentNames[id],state:ok ? '確認済み（対象店・対象商品）' : ((options.checks || {})[id] || '未確認（非対応とは断定しません）')};
    });
    a.rows.push([name,aliases,pi,qi,sourceKeys,[text(note)],[],text(options.status || '店舗・決済条件確認'),text(options.pointStatus || (points.length?'提示条件は下記参照':'提示ポイントは未確認')),options.scope || '店頭']);
    a.storeMeta[name] = {date,combination,checks,pointCaption:options.pointCaption,pointHeading:options.pointHeading,partial:!!options.partial,aeonOwners:!!options.aeonOwners,notice:options.notice || '',scopeHint:options.scopeHint || '支店・対象商品・決済方式は店頭表示もご確認ください。',conditions:options.conditions || [],matchRequired:options.matchRequired || '',excludeTerms:options.excludeTerms || []};
  }
  function augment(names, id, sourceKeys) {
    for (const name of names) {
      const r = a.rows.find(r => r[0] === name); if (!r) continue;
      const pay = a.pay[r[2]].map(p => ({...p}));
      if (!pay.some(p => p.id === id)) pay.push({id});
      r[2] = a.pay.push(pay) - 1;
      r[4] = Array.from(new Set([...r[4], ...sourceKeys]));
      r[5] = [...r[5], text(date + '：' + (id === 'famipay' ? 'FamiPay（バーコード／Smart Code）' : 'AEON Pay（コード払い）') + 'を追加確認。一部対象外店舗・商品を除きます。')];
    }
  }
  const qr = ['paypay','rakuten','dpay','aupay'];
  add('マルエツ',['まるえつ','maruetsu','マルエツ中川駅前','マルエツ中川駅前店','マルエツ港北ニュータウン','マルエツプチ','maruetsu petit','リンコス','lincos'],['paypay','aeonGroup','dpay','aupay','card','cash'],[
    {n:'WAON POINT',r:'税抜0.5%',x:'会計前にカード・会員コード提示'}
  ],['maruetsuPay','maruetsuPoint','maruetsuV','aeonGroup','aeonOwnersPay'],
  '魚悦糀谷店を除く対象店舗・商品。楽天Edy対応と楽天ペイ対応は別です。楽天ペイ・FamiPayは今回の公式決済一覧で確認できず、順位には入れていません。Vポイントの提示サービスは終了。イオンのオーナーズカードはマルエツでは対象外です。',
  'WAON POINTを提示してからPayPay 1.5%。提示分は200円税抜で1P、決済分は別枠です。AEON Payは対象コード払い1.0%＋提示分。楽天ポイント・dポイント・Pontaの提示分は確認できていないため加算しません。',
  {pointCaption:'提示分と決済分は別々',checks:{rakuten:'公式一覧で未確認（楽天Edyとは別）',famipay:'バーコード対応は未確認'},excludeTerms:['魚悦'],conditions:['マルエツのWAON POINT提示分は対象の決済方法すべてで進呈。税込の決済還元率と税抜の提示率を一律2.0%などと合計しません。店舗専用カードの日別割引・キャンペーンは通常順位に含めません。'],scopeHint:'マルエツ・マルエツプチ・リンコスの対象レジ。魚悦糀谷店は除外。Scan&Goやオンラインは別の条件です。'});
  add('ベルク',['belc','ベルクフォルテ','ベルク北山田','ベルク都筑'],[...qr,'card','cash','belcMoney'],[
    {n:'ベルクカード',r:'税抜0.5%',x:'QR・他社カード等'},
    {n:'ベルクカード',r:'税抜1.0%',x:'現金・ベルクペイ等'}
  ],['belcPay','belcPoint','belcMoney'],
  'クルベ（CLBE）は現金のみ・ベルクカード対象外。ベルクスは別のチェーンです。イオンのクレジットカード対応とAEON Pay対応は別です。',
  'PayPay 1.5%＋ベルクカード（200円税抜で1P）。現金・ベルクペイは100円税抜で1P。二つの提示率は同時加算しません。',
  {pointCaption:'支払い方法で付与率が変わる',checks:{aeonpay:'公式決済一覧に記載なし・利用前に確認',famipay:'バーコード対応は未確認・利用前に確認'},excludeTerms:['ベルクス','クルベ','clbe'],conditions:['ベルクカード500Pで500円お買物券。ベルクペイの1万円現金チャージで100円分の特典は、指定チャージ機で1回1万円の条件。支払い自体のポイントや他社カードのチャージ特典としては扱いません。']});
  add('Fit Care DEPOT',['フィットケアデポ','フィットケアデポ北山田','Fit Care DEPOT 北山田店','Fit Care Express','Fit Care MART','カメガヤ','fitcare'],['paypay','rakuten','dpay','famipay','card','cash'],[
    {n:'カメガヤポイント',r:'税抜0.5%',x:'現金・自社電子マネー'},
    {n:'カメガヤポイント',r:'税抜0.25%',x:'クレジットカード'},
    {n:'QRコード払い',r:'提示分なし',x:'自社ポイントは付きません'}
  ],['fitPay','fitD','smartCode','fitPoint'],
  'QR対応は共同発表・現行Smart Code一覧等を確認。一部店舗・商品は除外。musée de peauはポイント条件が異なるため、このデータを適用しません。',
  'PayPay・楽天ペイ・FamiPayなどのQR払いには、カメガヤの提示ポイントを上乗せしません。クレカは400円税抜で1P、現金等は200円税抜で1P。',
  {pointCaption:'支払いにより異なる・通常ランク',conditions:['年次ランクなどの上乗せは未設定です。クーポン・特売品・調剤などの対象外条件も確認してください。']});
  const mallPending = '公式の施設・店舗ページは確認しましたが、決済案内のブランド画像を取得できず、この支店の各QRブランドを確定できていません。非対応とは断定せず、店頭確認待ちにしています。';
  add('わくわく広場 ノースポート・モール店',['わくわく広場','わくわく','wakuwaku hiroba','ノースポートわくわく'],[],[],['northWaku','northPay'],mallPending,
    '店舗登録済み。支店の決済ブランドを確定できていないため、PayPayやAEON Payの還元率で順位は付けていません。',
    {status:'支店の決済確認待ち',partial:true,notice:'QR決済の対応確認待ち',matchRequired:'ノースポート',scopeHint:'ノースポート・モール店の確認用です。他支店へは自動適用しません。'});
  add('カルディ ノースポート・モール店',['カルディ','KALDI','カルディコーヒーファーム','ノースポートカルディ'],['kaldiCard'],[
    {n:'コーヒーポイント',r:'豆の購入時',x:'200円税込で1P・100Pで1,000円分'}
  ],['northKaldi','northPay','kaldiCard'],mallPending+' カルディカードのチャージ特典は確認済み。コーヒーポイントはオリジナルコーヒー豆が対象で、一般の食品には適用しません。',
  'カードへのチャージ金額に1%分の特典。決済時1%とは別です。コーヒーポイントは対象の豆だけで、全商品に5%を足す計算はしません。',
  {status:'カード特典確認・QR対応確認待ち',partial:true,pointCaption:'対象のコーヒー豆のみ',notice:'QR決済の対応確認待ち',matchRequired:'ノースポート',scopeHint:'ノースポート・モール店として登録。別支店の決済対応を自動で流用しません。'});
  add('都筑阪急',['つづきはんきゅう','都築阪急','モザイクモール都筑阪急'],[],[
    {n:'店舗ポイントカード',r:'率・併用条件未確認',x:'カード種類を確認'}
  ],['hankyuLocal','hankyuPoints'],
  '公式店舗とポイントカードの存在は確認。売場ごとの現在の決済ブランド・ポイント条件を確定できていないため、別の阪急店舗やモザイクモール専門店の条件は流用しません。',
  '売場の決済表示とカード種類を確認してください。ポイントカードの存在だけから、すべてのQR払いへ提示ポイントを加算することはしません。',
  {status:'売場別の決済確認待ち',partial:true,notice:'売場の支払い方法・ポイント率は確認待ち'});
  add('ヨークフーズ',['ヨーク','ヨークフーズ港北店','ヨークフーズ港北','ヨークマート','york foods','yorkmart'],[...qr,'famipay','card'],[],['yorkLocal','smartCode'],
  '港北店の公式決済表示（PayPay・楽天ペイ・d払い・au PAY・Smart Code・カード等）を確認。商業施設の専門店は別条件です。nanaco等の決済分を提示ポイントとして重ねません。',
  '通常設定ではPayPay 1.5%を先、楽天ペイ1.5%を次に表示。FamiPayはSmart Code対応会計で0.5%。提示ポイントは未確認のため合算しません。',
  {scopeHint:'港北店の公式表示を基準にしています。他の支店は店頭表示を確認してください。'});
  add('そうてつローゼン',['ローゼン','相鉄ローゼン','そうてつローゼンモザイク港北','そうてつローゼンモザイク港北店','sotetsu rosen'],qr,[
    {n:'相鉄POINT',r:'税抜0.5%',x:'200円税抜で1P・会員提示'}
  ],['rosenPay','rosenPoint'],
  '公式の2026年6月案内で主要4種QR対応とAEON Pay利用不可の明記を確認。掲載キャンペーンの還元率は通常還元に含めません。',
  'PayPay 1.5%と楽天ペイ1.5%を比較。相鉄POINTは会員提示・対象商品などの条件を確認し、税抜基準の進呈分と決済分を区別します。',
  {checks:{aeonpay:'利用不可（公式2026年6月案内）',famipay:'バーコード対応未確認'},pointCaption:'会員提示・対象商品に限る'});
  add('コーナン',['ホームセンターコーナン','コーナン港北ニュータウン店','コーナン港北ニュータウン','kohnan','コーナンPRO'],[...qr,'famipay','card'],[
    {n:'楽天',r:'税抜0.5%',x:'200円税抜で1P'}
  ],['kohnanPay','kohnanPoint','smartCode'],
  '主要4種QR・FamiPay・クレジットカードの公式案内を確認。AEON Payのコード払い対応は今回の公式一覧では確定していません。ポイント増量キャンペーンは通常率に含めません。',
  '楽天ポイントカードを提示してからPayPay 1.5%で支払い。楽天の提示分は200円税抜で1P。楽天ペイ1.5%も別の候補として残します。');
  add('Olympic',['オリンピック','Olympic港北ニュータウン','オリンピック港北ニュータウン店','オリンピック港北ニュータウン'],['paypay','card','cash'],[
    {n:'とこポン',r:'税抜0.5%',x:'キャッシュレス払い'},
    {n:'とこポン',r:'税抜1.0%',x:'現金払い'}
  ],['olympicPoint'],
  '公式FAQで現金・クレジットカード・PayPay等を確認。買い物200円税抜以上の対象会計が条件。YourPetia等の別業態へは適用しません。',
  'PayPay 1.5%＋とこポン（200円税抜で1P）。現金は100円税抜で1P。500Pで500円お買物券になり、現金向けとQR向けの付与率は合算しません。',
  {pointCaption:'支払い別・対象会計のみ'});
  add('成城石井',['seijo ishii','seijoishii'],[...qr,'famipay','card'],[],['seijoLocal','smartCode'],
  '成城店の公式決済一覧とSmart Code一覧を確認。各支店のレジ対応は異なる場合があります。店舗独自会員特典の固定還元率は未設定です。',
  'PayPayと条件達成済み楽天ペイは1.5%。FamiPayはSmart Code対応店で0.5%。確認できていない提示特典は合算しません。',
  {scopeHint:'公式の成城店の表示例です。利用する支店の対応も確認してください。'});
  add('AOKI',['アオキ','aoki','AOKI港北','AOKI横浜都筑'],['paypay','aeonpay'],[
    {n:'AOKIポイント',r:'支払い・ランク別',x:'アプリで確認'}
  ],['aeonShop','pp','aokiApp'],
  'PayPay公式とAEON Pay公式に掲載。AOKIの会員ランク・支払方法別ポイントはアプリで確認。クスリのアオキ・アオキスーパーとは別店舗です。',
  '確認できた決済ではPayPay 1.5%、AEON Pay 0.5%。AOKIポイントは支払方法・会員ランクの確認前に最大率を足しません。',
  {partial:true,excludeTerms:['クスリのアオキ','アオキスーパー','フードストアあおき']});
  add('ヨドバシカメラ',['ヨドバシ','yodobashi','ヨドバシ横浜','マルチメディア横浜'],[],[
    {n:'ゴールドポイント',r:'商品・支払い別',x:'会計前に公式アプリを提示'}
  ],['yodoApp'],
  '公式アプリの店頭ポイント機能を確認。現在の商品別還元率と各決済の組み合わせを今回の取得情報で確定できなかったため、全商品10%や未確認のQR対応は設定しません。',
  '会計前にゴールドポイントのアプリを準備。商品の表示還元率と支払いによる違いを確認してから比較してください。QR決済のアプリ画面とは別です。',
  {status:'商品・決済条件の確認待ち',partial:true,notice:'商品別の還元率・決済方式は確認待ち'});
  const aeonPoints=[{n:'WAON POINT',r:'決済分に含む',x:'AEON Payの1.0%と重複加算しない'}];
  const aeonNote='AEON Payのイオンカード払い／チャージ払いの対象コード決済は200円税込ごと2 WAON POINT。ポイント利用分や対象外商品・カードは除きます。電子マネーWAONのタッチ払い、テナント専門店、他のQR決済とは別です。';
  for (const row of [
    ['イオン',['AEON','イオン横浜新吉田','イオン横浜新吉田店']],
    ['イオンスタイル',['AEON STYLE','イオンスタイル横浜高田','イオンスタイル横浜高田店']]
  ]) add(row[0],row[1],['aeonGroup','cash'],aeonPoints,['aeonShop','aeonGroup','aeonOwners','aeonOwnersPay','aeonOwnersFaq'],aeonNote,
    'オーナーズカードを会計前に提示。返金率を選ぶと、対象決済に限り優待分を加えて比較します。WAON POINTの決済分を提示分として重ねません。',
    {aeonOwners:true,pointHeading:'ポイントの扱い',pointCaption:'決済ポイントの二重加算なし',partial:true,scopeHint:'イオンの直営売場を想定。モール内の専門店へは適用しません。',conditions:['株主優待は現金・WAON・イオンマークのカード・対象AEON Payなど指定の支払いが条件です。PayPayや他社カードへ優待分は加算しません。','オーナーズカードを支払い前に提示。家族カード利用分を含む半年100万円までが返金対象。AEON PayのWAON POINT充当分、地域キャンペーンを経由する支払いは優待対象外です。','返金率は権利確定時の株数による1・2・3・4・5・7%。画面の3%は仮設定です。実際の返金率へ変更できます。日別の感謝デー割引は自動加算しません。']});
  const welciaPoints=[{n:'WAON POINT',r:'税抜1.0%',x:'会員提示・対象商品'},{n:'V',r:'税抜0.5%',x:'会員連携で併用可'}];
  for (const row of [
    ['ハックドラッグ',['HAC','ハック','ハックドラッグ港北東急SC','ハックドラッグ都筑阪急']],
    ['ウエルシア',['welcia','ウェルシア']]
  ]) add(row[0],row[1],['paypay','famipay','aeonGroup'],welciaPoints,['pp','smartCode','aeonShop','aeonGroup','welciaPoint','welciaBoth'],
    'WAON POINTとVポイントはウエルシアメンバー登録・カード連携・提示等の条件下で併用できます。ポイントを使った支払い、調剤や対象外商品は別条件です。',
    '対象条件でWAON POINTとVポイントを両方提示してから決済。提示分は税抜、PayPay・FamiPay・AEON Payの決済分は別基準なので単純な一律合計にはしません。',
    {pointCaption:'会員連携で両方提示可',partial:true,conditions:['20日のポイント利用特典は、通常購入のポイント還元率とは別制度のため自動加算しません。']});
  add('ヤマダデンキ',['ヤマダ','山田電機','ヤマダ電機','Tecc LIFE SELECT 港北センター店','ヤマダ港北センター','yamada denki'],['paypay','famipay','aeonpay'],[
    {n:'ヤマダポイント',r:'商品・支払い別',x:'レジの表示率を確認'}
  ],['pp','smartCode','aeonShop'],'FamiPayはSmart Code対象店舗、AEON Payはコード払い対応店を確認。商品ごとの店舗ポイント率と決済による減算は店頭で確認します。',
  '決済分はPayPay 1.5%、FamiPay・AEON Payは0.5%。ヤマダポイントが決済方法で変わる商品では、表示価格とポイントを合わせて確認してください。',
  {partial:true,notice:'店舗ポイントは商品・支払方法で変わります'});
  add('ビッグヨーサン',['ビッグヨーサン横浜都筑','ビッグヨーサン横浜都筑店','big yosun'],['paypay'],[],['pp'],
  'PayPay公式の対応店一覧に掲載。その他の決済・店舗会員特典は今回未確認です。',
  '確認済みのPayPayは指定1.5%。ほかの決済や提示ポイントを非対応と断定せず、確認待ちにしています。', {partial:true});
  add('サミット',['サミットストア','summit'],['paypay'],[],['pp'],
  'PayPay公式の対応店一覧に掲載。ポイントカードの支払い別進呈率と他の決済は未確認です。',
  '確認済みのPayPayは指定1.5%。サミットの店舗ポイントを現金とQRで同じ率と決めつけて合算しません。', {partial:true});
  add('セリア',['Seria','セリアセンター南モール','セリアセンター南モール店','セリアモザイクモール港北','セリアモザイクモール港北店'],['paypay','dpay','aupay','famipay','aeonpay','card'],[],['seriaLocal','seriaSearch','pp','smartCode','famiGeneral','aeonShop','seriaRakuten'],
  'モザイクモール港北店の公式店舗ページでPayPay・楽天ペイ・d払い・au PAY・AEON Pay・Smart Code・クレジットカード・交通系IC・iD・QUICPay・WAON・nanaco・楽天Edyを確認。支店・レジごとに対応が異なるため全国一律の対応とは扱いません。FamiPayはSmart Code対応レジでのバーコード払いです。',
  '対応店舗・レジではPayPay 1.5%を基本比較。d払いは通常0.5%（dカード設定なら計1.0%、他社カード設定はd払い自体0%）。au PAY・FamiPay・AEON Payは通常0.5%。楽天ペイは使える店舗でも還元対象外の注記があるため、楽天キャッシュ1.5%として順位へ入れていません。提示ポイントは別で、未確認分を加算しません。',
  {partial:true,notice:'PayPayなどは対応店舗・レジのみ／楽天ペイは還元条件に注意',checks:{rakuten:'対応店舗あり・還元対象外の掲載あり（1.5%で比較しません）'},scopeHint:'公式確認例：モザイクモール港北店。センター南モール店など他の支店は、セリア公式店舗検索の「お支払方法」と利用するレジの表示を確認してください。',conditions:['楽天ペイの利用可否とポイント進呈対象は別です。公式の還元対象外一覧にセリアが掲載されています。支店ごとの適用を確認できていないため、楽天キャッシュ払いを一律1.5%としておすすめしません。楽天カードを支払元に設定したコード・QR払いは公式案内ではカードから1%が進呈されますが、楽天キャッシュ払いとは別ルートです。','楽天ペイ対応だけで楽天ポイントカードの提示にも対応すると判断しません。施設独自ポイントは支店・支払い条件を確認し、決済ポイントと分けて扱います。']});
  a.storeMeta['セリア'].date = '2026-09-09';
  augment(['オーケー','東急ストア','三和・フードワン','近商ストア'], 'famipay', ['smartCode','famiGeneral']);
  augment(['ミニストップ'], 'aeonGroup', ['aeonShop','aeonGroup']);
  augment(['ローソン','ナチュラルローソン','ローソンストア100','セイコーマート','アオキスーパー','スシロー','CoCo壱番屋','かっぱ寿司','くら寿司','フレッシュネスバーガー','ガスト','バーミヤン','しゃぶ葉','夢庵','ジョナサン','ステーキガスト','むさしの森珈琲','から好し','藍屋','とんから亭','La Ohana','魚屋路','桃菜','グラッチェガーデンズ','八郎そば','ゆめあん食堂','すき家','はま寿司','ココス','なか卯','ジョリーパスタ','ビッグボーイ','ヴィクトリアステーション','華屋与兵衛','熟成焼肉いちばん','かつ庵','オリーブの丘','久兵衛屋','伝丸','ゼッテリア','一風堂','ドトール','エクセルシオール','丸亀製麺','松屋','松のや','吉野家'], 'aeonpay', ['aeonShop','aeonRate']);
  a.localUpdate = {date,added:21,total:a.rows.length};
  a.settings.aeonPay = 0.5; a.settings.aeonPayGroup = 1; a.settings.famiPay = 0.5;
  window.PAYMENT_LOCAL_READY = true;
})();
