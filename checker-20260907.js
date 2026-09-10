try {

"use strict";
// App icons and the manifest are static assets linked in the HTML head.
// Verified acceptance and personal comparison rates are separate data.
const AUDIT=window.PAYMENT_AUDIT_DATA;
if(!window.PAYMENT_LOCAL_READY)throw new Error('追加店舗データを読み込めません。通信状態を確認して再読み込みしてください。');
if(!AUDIT||!Array.isArray(AUDIT.rows))throw new Error('店舗データを読み込めません。ページを再読み込みしてください。');
const MF_COND='三菱UFJ 12.5%はMDCアプリで確認した設定値。三菱UFJ銀行の支払口座・MDCエントリーと各加算条件が前提。対象店の合計利用額は毎月16日〜翌月15日に5万円まで（超過分は通常0.5%）。家族カード利用分も含め枠を確認。グローバルポイントを1P=5円相当で交換する評価で、キャッシュバック1P=4円なら設定12.5%は10.0%相当。カードブランド・対象店舗・決済方式を確認してください。';
const MF_MODE='三菱UFJ：カード現物の対象決済、または対応店で対象のApple Pay（QUICPay）。スマホのVisa／Mastercardタッチやグローバルポイント Wallet払いは対象外。チャージ・オンライン専用店では各店の別条件に従ってください。';
const OLIVE_COND='Olive 8%：クレジットモードの対象スマホタッチ決済。現物カードのタッチ・差し込み・iDは8%対象外。一般の三井住友カード7%と区別しています。モバイルオーダーは公式の対象ブランド・指定方式に限ります。';
const RP_COND='楽天ペイ1.5%：楽天キャッシュを支払元にし、適用月の前々月16日〜前月15日に対象アプリの楽天ポイントカードを2回以上提示して各回1ポイント以上獲得。未達時は1.0%。プラスチックカード提示等は判定対象外。ポイント進呈対象外店・商品は除きます。提示ポイントそのものは別欄で、1.5%に自動で含まれるわけではありません。';
const PP_COND='PayPayは指定の1.5%を比較用設定値として使用。全員一律ではないため実際のPayPayステップ・支払元・対象商品をアプリで確認。同率の楽天ペイより先に表示します。';
const DP_COND='d払い：残高等の対象支払元は0.5%、dカードを支払元に設定すると計1.0%。dカード以外のクレジットカードを支払元にした場合、d払い自体のポイントは0%（カード会社の特典は別）。この一覧は0.5%を基本比較値にしています。';
const AU_COND='au PAY：通常は200円税込につき1Pで0.5%。チャージ元カードや特定料金プラン等の加算は別条件なので自動加算しません。Pontaの提示分と決済分を区別します。';
function method(n,r,x,conditions,src,rankable=true){return{n,r,x,conditions,src,rankable};}
const METHODS={
 paypay:method('PayPay','1.5%','指定の還元率',[PP_COND],['ppstep']),
 rakuten:method('楽天ペイ','1.5%','楽天キャッシュ・条件達成時',[RP_COND],['rprate','rpex']),
 dpay:method('d払い','0.5%','残高等／dカード設定なら1.0%',[DP_COND],['dprate','dpcard']),
 aupay:method('au PAY','0.5%','通常の決済ポイント',[AU_COND],['aurate']),
 olive:method('Olive','8%','クレジットモード・スマホタッチ',[OLIVE_COND],['sm']),
 mufg:method('三菱UFJカード','12.5%','対象決済・5万円枠内',[MF_COND,MF_MODE],['mf']),
 card:method('Olive通常','0.5%','保有カードの通常還元を比較',['カード通常0.5%は保有カードの設定。カードを使えることと、8%／12.5%の指定方式で使えることは別です。'],['sm']),
 famipay:method('FamiPay','0.5%','バーコード／Smart Code・対象商品',['FamiPayのバーコード払いはFamiPay／Smart Code対応のレジで利用。通常200円税込でファミマポイント1円分（0.5%）。対象外店舗・商品を除きます。チャージ元カードや翌月払い、クーポンなどの加算は含めません。','FamiPayカードのJCB払い・Apple Pay等のQUICPay＋払いは、別の設定と加盟店条件が必要です。JCB対応だけでFamiPayバーコード対応とは判定していません。'],['famiGeneral','smartCode']),
 waon:method('電子マネーWAON','1.0%','会員登録済み・対象商品',['会員登録済みWAONは対象店で通常1.0%、未登録は0.5%。提示型WAON POINTカードとは別の決済制度です。'],['msw']),
 okCash:method('OKクラブ＋現金','約3%割引','対象食料品のみ',['対象食料品の3/103割引。カード・QR決済との二重取り不可。ポイントではなく値引きで、全商品・支払総額の一律3%ではありません。'],['ok']),
 suicaRegistered:method('登録済みSuica','0.5%','JRE POINTに事前登録',['JRE POINTに登録したSuicaで対象商品を支払うと200円税込につき1ポイント。カード・バーコードの提示だけでは貯まりません。チャージ元カード特典は含めません。'],['nd']),
 mufgOnline:method('三菱UFJカード','12.5%','公式オンラインに直接カード登録',[MF_COND,'対象公式サイト／アプリのカード払い専用。店舗レジや別アプリ経由、QR決済にカードを登録した場合とは区別します。'],['mf']),
 mufgRecurring:method('三菱UFJカード','12.5%','対象の会費支払い',[MF_COND,'カーブスの対象会費をカード払いする場合の比較。通常の店頭決済候補ではありません。'],['mf','mfnew']),
 mufgStar:method('三菱UFJカード','12.5%','スタバカードへオンラインチャージ',[MF_COND,'スターバックスカードへの指定オンラインチャージが対象。店頭チャージ・Apple Pay経由のチャージ・直接店頭払いは高還元対象外。'],['mf','mfnew']),
 oliveStar:method('Olive','8%','Apple Payでモバイルオーダー',[OLIVE_COND,'スタバのアプリ／App ClipからApple Payでモバイルオーダー。スタバカードへのチャージ、店頭タッチと混同しないでください。'],['sm']),
 mufgCoke:method('三菱UFJカード','12.5%','対象自販機・対象カードの登録',[MF_COND,'対象自販機の指定カード決済、Coke ON Pay／Passへの対象カード直接登録などが条件。Apple Pay経由のCoke ON決済は除外。'],['mf']),
 paypayCoke:method('PayPay','1.5%','Coke ON Pay対応機・指定還元率',[PP_COND,'Coke ON Pay対応自販機でPayPayが選べる場合のみ。スタンプは別制度で、円換算還元率に含めません。'],['pp']),
 rakutenCard:method('楽天ペイ（カード）','1.0%','支払元に楽天カードを設定',['楽天ペイの支払元を楽天カードに設定したコード・QR払いのカード還元。楽天キャッシュ払いとは異なり、その1.5%とは合算しません。'],['rpex']),
 paypayReview:method('PayPay','要確認','通常設定1.5%・店別の還元注記あり',[PP_COND,'NewDaysの公式案内にポイント等の対象外注記があります。適用範囲を確定できていないため、1.5%を確定したおすすめ順位には使用しません。'],['nd'],false),
 rakutenReview:method('楽天ペイ（楽天キャッシュ）','0%','コード・QR払いの通常還元対象外',['公式の還元対象外店舗では楽天キャッシュ払いの通常還元は0%。楽天カードを支払元にしたコード・QR払いのカード還元1%とは別ルートです。提示ポイントカードは別に確認します。'],['rpex'],false)
};
function combinationFor(store){
 if(store.local.aeonOwners){
  const best=store.payments.filter(p=>p.rankable).sort(paymentOrder)[0];
  if(!best)return '優待の対象支払いを確認してください。';
  if(!best.ownerRate)return best.n+'の決済分'+best.r+'で比較。今回はこの支払いに株主優待の返金を加算していません。';
  return 'オーナーズカードを会計前に提示。'+best.n+'の決済分'+best.r+' ＋ 株主優待'+best.ownerRate.toFixed(1)+'% ＝ '+comparisonLabel(best)+'目安。優待は後日の返金です。WAON POINTを二重に足しません。';
 }
 if(store.local&&store.local.combination)return store.local.combination;
 const name=store.store, best=store.payments.filter(p=>p.rankable).sort(paymentOrder)[0];
 if(!best)return '支払方法が未確認のため、還元率による順位は確定していません。店頭表示をご確認ください。';
 if(name==='ファミリーマート')return '楽天・d・Vのどれか0.5% ＋ PayPay 1.5% ＝ 計2.0%目安。楽天ペイも条件達成なら同率。';
 if(name==='オーケー')return '三菱UFJの対象決済12.5%と、対象食料品の現金割引を比較。現金割引はカード・QRへ重ねて加算しません。';
 if(name==='ミニストップ')return 'Olive 8%／PayPay 1.5%に、現金向けWAON POINT提示分を加算しません。電子マネーWAONの決済分も別です。';
 if(name==='NewDays')return 'Suica払いのJRE POINTは決済条件付き。PayPay払いにJREの提示ポイントを上乗せする計算はしません。';
 if(name==='セイコーマート')return 'カード決済の還元とクラブポイントは別制度。クラブポイントを1P＝1円と決めつけて加算しません。';
 if(name==='スタバ')return '三菱UFJのオンラインチャージ12.5%と、Oliveの指定モバイルオーダー8%は別ルート。合算しません。';
 if(name==='コカ・コーラ自販機'||store.audit.scope!=='店頭')return '表示の対象ルートで支払う場合のみ。決済手段を重ねたり、別サービスのスタンプを円換算して足したりしません。';
 if(name==='ココス')return '対象店では共通ポイント1種類0.5%を別途。富山・石川・福井・岐阜・滋賀・奈良・京都の対象外店には加算しません。';
 if(['ローソン','ナチュラルローソン','ローソン・スリーエフ'].includes(name))return 'Pontaかdを1種類提示。200円税抜ごと昼1P／16時以降2P ＋ 決済還元。au PAYの自動加算と手動提示を二重計上しません。';
 if(name==='ローソンストア100')return '通常ローソンの夕方2倍は適用しません。Ponta・dとも200円税抜ごと1P。両方は加算せず1種類を選びます。';
 if(name==='東急ストア')return '対象条件下で楽天とTOKYUの両方を提示。各200円税抜ごと1P ＋ 決済還元。税込支払額に一律1%を足す計算ではありません。';
 if(name==='ベルマート')return 'TOKAI STATION POINT対象店でアプリ提示（110円税込ごと1P）＋決済還元。支店・対象外商品の確認が必要です。';
 const active=store.points.filter(p=>typeof p.base==='number');
 const single=active.filter(p=>p.x!=='併用可'),extra=active.filter(p=>p.x==='併用可');
 if(active.length){const add=(single.length?Math.max(...single.map(p=>p.base)):0)+extra.reduce((s,p)=>s+p.base,0);const total=configuredRate(best.r)+add;return '提示ポイント'+add.toFixed(1)+'%（共通ポイントは1種類）＋ '+best.n+' '+best.r+' ＝ 計'+total.toFixed(1)+'%目安。各条件と端数処理によって変わります。';}
 if(store.points.some(p=>p.r.startsWith('税抜')))return 'ポイントカードを対象条件で提示してから支払い。提示分は税抜金額を基準に付くため、税込決済還元率との単純合計は目安にも誤差があります。';
 if(store.points.some(p=>p.r.includes('終了')))return '終了したポイントカードの提示分は加算しません。支払方法のポイントは別に比較します。';
 return '提示ポイントの進呈率・併用条件が未確認の項目は、合計還元率に加算しません。';
}

// Payment products remain distinct from point-card presentation and charge bonuses.
Object.assign(METHODS, {
 aeonpay:method('AEON Pay','0.5%','通常・コード払い',['AEON Payの通常コード払いは200円税込ごと1 WAON POINT（0.5%）。イオンカード払い／チャージ払いの対象条件を確認。ポイント利用分・対象外カードや商品は除外。','イオンカードを使える店と、AEON Payコード払いを使える店は別です。電子マネーWAONのタッチ決済とも分けています。キャンペーン・チャージ元特典は通常率に足しません。'],['aeonShop','aeonRate']),
 aeonGroup:method('AEON Pay','1.0%','2倍対象店・コード払い',['イオン等の指定2倍対象店では200円税込ごと2 WAON POINT（1.0%）。イオンカード払い／チャージ払いのコード決済が対象。WAON POINT利用分やイオンJMBカード等の対象外条件に注意。','この1.0%は通常ポイントを含みます。さらに0.5%を足したり、同じWAON POINTを提示分として重ねたりしません。専門店や他のQR決済に2倍を自動適用しません。'],['aeonShop','aeonGroup','aeonRate']),
 cash:method('現金','0%','支払い自体のポイントなし',['現金の支払い自体には決済ポイントを設定しません。店舗ポイント・値引きがある場合は別欄で比較してください。'],[]),
 kaldiCard:method('カルディカード','チャージ特典1%','支払い時の還元率ではありません',['チャージ金額の1%分がバリューとして加算。支払い時の1%還元とは別の特典なので、決済順位には入れていません。対象のコーヒー豆のポイントも別制度です。'],['kaldiCard'],false),
 belcMoney:method('ベルクペイ','チャージ特典あり','1万円現金チャージで100円分',['指定チャージ機で1回1万円の現金チャージをする特典。レジチャージや複数回合算とは区別。ベルクカード提示の購入ポイントと、チャージ特典を二重に支払い還元へ計上しません。'],['belcMoney','belcPoint'],false)
});

const OWNER_KEY='payment-checker-aeon-owners-rate';
const OWNER_RATES=[0,1,2,3,4,5,7];
function readOwnerSetting(){try{const raw=localStorage.getItem(OWNER_KEY);const value=Number(raw);if(raw!==null&&OWNER_RATES.includes(value))return{rate:value,confirmed:true};}catch(_){}return{rate:3,confirmed:false};}
let ownerSetting=readOwnerSetting();
function comparisonRate(payment){return configuredRate(payment.r)+(payment.ownerRate||0);}
function comparisonLabel(payment){return payment.ownerRate?comparisonRate(payment).toFixed(1)+'%':payment.r;}
function refreshStoreSummary(store){
 for(const payment of store.payments)payment.ownerRate=store.local.aeonOwners&&(store.local.ownerPaymentIds||[]).includes(payment.id)?ownerSetting.rate:0;
 const top=store.payments.filter(p=>p.rankable).sort(paymentOrder);
 [store.first,store.second,store.third]=[0,1,2].map(i=>top[i]?paymentLabel(top[i]):'確認済み候補なし');
 store.combination=combinationFor(store);
}
function ownerControls(store){
 const notice=store.local.ownerNotice?'<div class="note"><strong>'+escapeHtml(store.local.ownerNotice)+'</strong></div>':'';
 if(!store.local.aeonOwners)return notice;
 return notice+'<div class="owners-setting"><label for="ownersRate">オーナーズカード</label><select id="ownersRate" aria-label="オーナーズカードの返金率">'+OWNER_RATES.map(rate=>'<option value="'+rate+'"'+(rate===ownerSetting.rate?' selected':'')+'>'+(rate===0?'今回は使わない':rate+'%返金')+'</option>').join('')+'</select><small id="ownersNote">'+(ownerSetting.confirmed?'選択した率で比較':'3%は仮設定・実際の返金率を選択')+'</small></div>';
}
const STORE_DATA=AUDIT.rows.map(row=>{
 const [name,aliases,payIdx,pointIdx,src,notes,missing,status,pointStatus,scope]=row;
 const local=(AUDIT.storeMeta||{})[name]||{};
 const payments=AUDIT.pay[payIdx].map(p=>{const def=METHODS[p.id];if(!def)throw new Error('未定義の支払い方式：'+p.id);return{...def,id:p.id,x:[p.x,def.x].filter(Boolean).join('・')};});
 const sourceKeys=Array.from(new Set([...src,...payments.flatMap(p=>p.src)])).filter(k=>k!=='sky'||AUDIT.points[pointIdx].some(p=>p.n==='すかいらーく'));
 const store={local,store:name,aliases:Array.from(new Set([name,...aliases])),payments,points:AUDIT.points[pointIdx].map(p=>({...p})),conditions:Array.from(new Set([...payments.flatMap(p=>p.conditions),...(local.conditions||[])])),note:notes.map(i=>AUDIT.text[i]).join(' '),audit:{date:local.date||AUDIT.date,status:AUDIT.text[status],pointStatus:AUDIT.text[pointStatus],scope,missing:missing.map(i=>AUDIT.text[i]),sources:sourceKeys}};
 refreshStoreSummary(store);return store;
});
function auditDetails(store){const a=store.audit;const local=store.local||{};const checks=(local.checks||[]).map(c=>'<div class="pay-option"><span>'+escapeHtml(c.name)+'</span><span>'+escapeHtml(c.state)+'</span></div>').join('');return (checks?'<div class="note"><h4>主なコード決済の対応状況</h4><div class="pay-options">'+checks+'</div><p>未確認の方法は順位・合計に含めません。</p></div>':'')+ (local.scopeHint?'<div class="note">'+escapeHtml(local.scopeHint)+'</div>':'')+'<div class="note"><h4>確認状況 · '+escapeHtml(a.date)+'</h4><p>'+escapeHtml(a.status)+'／'+escapeHtml(a.scope)+'</p><p>提示ポイント：'+escapeHtml(a.pointStatus)+'</p><p>ブランド・公式店舗例の確認です。全国すべての支店の実機確認ではありません。</p>'+a.missing.map(t=>'<p>'+escapeHtml(t)+'</p>').join('')+'<p>期間限定キャンペーン・クーポン・チャージ元特典は自動加算しません。税抜／税込、対象外商品、端数処理により実際の還元は変わります。</p><h4>公式の確認先</h4>'+a.sources.filter(k=>AUDIT.sources[k]).map(k=>{const [title,url]=AUDIT.sources[k];return '<p><a href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(title)+'</a></p>';}).join('')+'</div>';}

const $=id=>document.getElementById(id);
let lastSelectedStore=null;
function candidateGroupKey(matchStore){return matchStore.store;}
function normalizeText(value){return String(value||"").normalize("NFKC").toLowerCase().replace(/[ー‐-‒–—―\-−\s　・･'’`]/g,"").replace(/株式会社|有限会社|合同会社|店$/g,"").trim();}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));}
function setStatus(message,type="info"){const el=$("status");el.className="status "+type+(message?"":" hidden");el.innerHTML=message;}
function show(el){el.classList.remove("hidden");}
function hide(el){el.classList.add("hidden");}
function haversineMeters(lat1,lon1,lat2,lon2){const R=6371000,toRad=deg=>deg*Math.PI/180,dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1),a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function matchStoreFromText(text){const target=normalizeText(text);if(!target)return null;let best=null;for(const store of STORE_DATA){if(store.audit.scope!=='店頭')continue;const meta=store.local||{};if((meta.excludeTerms||[]).some(s=>target.includes(normalizeText(s))))continue;if(meta.matchRequired&&!target.includes(normalizeText(meta.matchRequired)))continue;for(const alias of store.aliases){const a=normalizeText(alias);if(a.length<3&&a!==normalizeText(store.store))continue;let score=0;if(target===a)score=1000+a.length;else if(target.includes(a))score=100+a.length;if(score&&(!best||score>best.score))best={store,score,alias};}}return best;}
function readOsmName(tags){return[tags["name:ja"],tags.name,tags.brand].filter(Boolean).join(" / ");}
function buildCandidatesFromOsm(osmJson,currentLat,currentLng,radius=Infinity){
 const groups=new Map(),seen=new Set();
 for(const el of osmJson.elements||[]){
  const tags=el.tags||{},nameText=readOsmName(tags),match=matchStoreFromText(nameText);if(!match)continue;
  const lat=typeof el.lat==="number"?el.lat:el.center?.lat,lng=typeof el.lon==="number"?el.lon:el.center?.lon;
  if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
  const rawDistance=haversineMeters(currentLat,currentLng,lat,lng);if(rawDistance>radius)continue;
  const distance=Math.round(rawDistance),seenKey=el.type+'-'+el.id+'-'+match.store.store;if(seen.has(seenKey))continue;seen.add(seenKey);
  const groupKey=candidateGroupKey(match.store),osmName=tags['name:ja']||tags.name||tags.brand||match.store.store,item={osmName,distance,lat,lng,score:match.score};
  if(!groups.has(groupKey))groups.set(groupKey,{source:"geo",store:match.store,distance,lat,lng,score:match.score,matches:[item]});
  else{const g=groups.get(groupKey);g.matches.push(item);if(distance<g.distance){g.distance=distance;g.lat=lat;g.lng=lng;}g.score=Math.max(g.score,match.score);}
 }
 const candidates=Array.from(groups.values()).map(g=>{g.matches.sort((a,b)=>a.distance-b.distance);g.osmName=g.matches[0]?.osmName||g.store.store;g.brandCount=g.matches.length;return g;});
 candidates.sort((a,b)=>a.distance-b.distance||b.score-a.score);return candidates.slice(0,18);
}
function renderCandidates(candidates,titlePrefix="候補"){
 const panel=$("candidatePanel"),bubbles=$("bubbles");bubbles.innerHTML="";if(!candidates.length){hide(panel);return;}
 $("candidateHeading").textContent=(titlePrefix.includes("現在地")?"近くのお店":"候補店舗")+" · "+candidates.length+"件";
 hide($("quickPanel"));hide($("allPanel"));hide($("resultPanel"));document.body.classList.remove("has-result");
 for(const c of candidates){const btn=document.createElement("button");btn.className="bubble";btn.type="button";const extra=c.source==="geo"?'<span class="dist">'+escapeHtml(c.distance)+'m</span>':'<span aria-hidden="true">→</span>';const osm=c.source==="geo"&&c.osmName&&c.osmName!==c.store.store?'<small>'+escapeHtml(c.osmName)+'</small>':'';btn.innerHTML='<span>'+escapeHtml(c.store.store)+osm+'</span>'+extra;btn.addEventListener("click",()=>renderPayment(c.store,c));bubbles.appendChild(btn);}show(panel);
}
function configuredRate(label){const match=String(label).match(/(\d+(?:\.\d+)?)%/);return match?Number(match[1]):0;}
function paymentOrder(a,b){const difference=comparisonRate(b)-comparisonRate(a);if(difference)return difference;return (a.n==='PayPay'?0:a.n==='楽天ペイ'?1:2)-(b.n==='PayPay'?0:b.n==='楽天ペイ'?1:2);}
function paymentLabel(payment){return payment.n+'（'+comparisonLabel(payment)+(payment.ownerRate?'・決済'+payment.r+'＋株主優待'+payment.ownerRate.toFixed(1)+'%':'')+(payment.x?'・'+payment.x:'')+'）';}
function renderPayment(store,context=null){
 cancelGeo();lastSelectedStore=store;$("manualSearch").value=store.store;document.activeElement?.blur();document.body.classList.add("has-result");
 hide($("candidatePanel"));hide($("quickPanel"));hide($("allPanel"));setStatus("");
 const allPayments=store.payments.slice().sort(paymentOrder),payments=allPayments.filter(p=>p.rankable);
 const meta=context&&context.source==="geo"?'現在地から約'+context.distance+'m'+(context.accuracy?'（位置の誤差 約'+Math.ceil(context.accuracy)+'m）':'')+(context.osmName&&context.osmName!==store.store?' · '+context.osmName:''):'お会計のおすすめ'+(store.local.notice?' · '+store.local.notice:'');
 const ranks=payments.slice(0,3).map((p,i)=>{
  const tied=i>0&&comparisonRate(p)===comparisonRate(payments[0]);
  const hint=p.ownerRate?'株主優待込み':i===0?(store.local.partial?'確認済み候補':'おすすめ'):tied?'同じ還元率':'';
  const detail=p.ownerRate?'決済 '+p.r+' ＋ 株主優待 '+p.ownerRate.toFixed(1)+'%':p.x;
  return '<div class="rank-card r'+(i+1)+'"><div class="rank-top"><span class="rank-label">'+['🥇 1位','🥈 2位','🥉 3位'][i]+'</span><span class="rank-hint">'+hint+'</span></div><div class="pay-main"><span class="pay-name">'+escapeHtml(p.n)+'</span><strong class="pay-rate">'+escapeHtml(comparisonLabel(p)||'要確認')+'</strong></div>'+(detail?'<div class="pay-extra">'+escapeHtml(detail)+'</div>':'')+'</div>';
 }).join('');
 const pts=store.points.map(p=>'<span class="point-pill">'+escapeHtml(p.n)+' <strong>'+escapeHtml(p.r)+'</strong>'+(p.x?' · '+escapeHtml(p.x):'')+'</span>').join('');
 const single=store.points.filter(p=>['楽天','d','V','Ponta','WAON POINT'].includes(p.n)).length>1;
 $("result").innerHTML='<div class="store-head"><div><h3 class="store-name">'+escapeHtml(store.store)+'</h3><div class="meta">'+escapeHtml(meta)+(store.audit.status!=='ブランド条件確認'?' · '+escapeHtml(store.audit.status):'')+'</div></div><button id="changeStoreBtn" type="button" class="btn ghost small">店を変える</button></div>'+ownerControls(store)+'<div class="rank-grid">'+(ranks||'<div class="note">支払方法を確認中です。未確認の還元率では順位を付けません。</div>')+'</div><section class="point-box"><div class="point-head"><h4>'+escapeHtml(store.local.pointHeading||'会計前に提示')+'</h4><small>'+escapeHtml(store.local.pointCaption||(single?'共通ポイントは1種類':'支払いポイントとは別'))+'</small></div><div class="point-pills">'+(pts||'<span class="micro">'+escapeHtml(store.audit.pointStatus)+'</span>')+'</div>'+(store.points.some(p=>p.x==='併用可')?'<p class="point-foot">「併用可」の店舗ポイントは別に貯められます。</p>':'')+'</section><div class="combo"><strong>＋ ポイントと支払いの組み合わせ</strong><p>'+escapeHtml(store.combination)+'</p></div><details class="more"><summary>還元条件・ほかの支払い</summary><div class="note"><h4>還元条件</h4>'+(store.conditions.map(c=>'<p>'+escapeHtml(c)+'</p>').join('')||'店舗・利用方法ごとの条件をご確認ください。')+'</div><div class="note"><h4>使える主な支払い候補</h4><div class="pay-options">'+allPayments.map(p=>'<div class="pay-option"><span>'+escapeHtml(p.n)+(p.x?'<small>'+escapeHtml(p.x)+'</small>':'')+(p.ownerRate?'<small>決済 '+escapeHtml(p.r)+' ＋ 株主優待 '+p.ownerRate.toFixed(1)+'%</small>':'')+'</span><strong>'+escapeHtml(comparisonLabel(p)||'要確認')+'</strong></div>').join('')+'</div></div><div class="note"><h4>備考</h4>'+escapeHtml(store.note)+'</div>'+auditDetails(store)+'<div class="detail-tools"><button id="copyBtn" type="button" class="btn ghost small">結果をコピー</button><button id="resultListBtn" type="button" class="btn secondary small">登録店一覧</button></div></details>';
 show($("resultPanel"));$("changeStoreBtn").onclick=()=>{clearView();$("manualSearch").focus();};$("copyBtn").onclick=copyResult;$("resultListBtn").onclick=openStoreList;
 if(store.local.aeonOwners)$("ownersRate").onchange=event=>{
  const rate=Number(event.target.value);if(!OWNER_RATES.includes(rate))return;
  ownerSetting={rate,confirmed:true};try{localStorage.setItem(OWNER_KEY,String(rate));}catch(_){}
  STORE_DATA.filter(s=>s.local.aeonOwners).forEach(refreshStoreSummary);renderPayment(store,context);$("ownersRate").focus();
 };
 rememberStore(store.store);window.scrollTo({top:0,behavior:"auto"});
}
function searchManual(keyword){const q=normalizeText(keyword);if(!q)return[];const results=[];for(const store of STORE_DATA){if(((store.local||{}).excludeTerms||[]).some(s=>q.includes(normalizeText(s))))continue;const haystack=normalizeText([store.store,...store.aliases].join(" "));if(haystack.includes(q))results.push({source:"manual",store});}return results;}
let geoRequest=0,geoController=null,locationClient=null;
function resetGeoButtons(){for(const id of ['geoBtn','resultGeoBtn']){const button=$(id);if(button){button.disabled=false;button.removeAttribute('aria-busy');button.textContent=id==='geoBtn'?'🧭 現在地から探す':'🧭';}}}
function cancelGeo(){geoRequest++;if(geoController){geoController.abort();geoController=null;}resetGeoButtons();}
async function handleGeoSearch(){
 if(geoController){cancelGeo();setStatus('検索を中止しました。店名でも探せます。');return;}
 cancelGeo();
 if(!navigator.geolocation||!window.PaymentLocation){setStatus('現在地検索を利用できません。店名検索はそのまま使えます。','error');return;}
 const request=geoRequest,controller=new AbortController();geoController=controller;
 const radius=Number($('radiusSelect').value||250);
 $('manualSearch').blur();
 for(const id of ['geoBtn','resultGeoBtn'])$(id).setAttribute('aria-busy','true');
 $('geoBtn').textContent='📍 位置を確認中 · 中止';$('resultGeoBtn').textContent='✕';
 setStatus('位置情報を確認しています。待たずに店名でも検索できます。');
 try{
  if(!locationClient)locationClient=window.PaymentLocation.createClient();
  const position=await locationClient.locate(controller.signal,radius,()=>{if(request===geoRequest)setStatus('位置の精度を上げています。店名検索も使えます。');});
  if(request!==geoRequest)return;
  if(position.accuracy>Math.max(radius,100)){setStatus('位置の誤差が約'+Math.ceil(position.accuracy)+'mあります。店名で検索するか、もう一度現在地を確認してください。','error');return;}
  $('geoBtn').textContent='📡 近くのお店を検索中 · 中止';setStatus('半径'+radius+'mのお店を探しています…');
  const result=await locationClient.search(position,radius,controller.signal);
  if(request!==geoRequest)return;
  const candidates=buildCandidatesFromOsm(result.data,position.lat,position.lng,radius);
  if(!candidates.length){setStatus('候補が見つかりませんでした。検索半径を広げるか、店名を入力してください。','error');return;}
  for(const candidate of candidates)candidate.accuracy=position.accuracy;
  setStatus((result.cached?'直近の周辺データを使用 · ':'')+'位置の誤差 約'+Math.ceil(position.accuracy)+'m・距離は目安です。');
  renderCandidates(candidates,'現在地候補');
 }catch(error){
  if(request!==geoRequest||error.name==='AbortError')return;
  const messages={1:'位置情報が許可されていません。ブラウザのサイト設定を確認するか、店名で検索してください。',2:'現在地を特定できませんでした。店名検索はそのまま使えます。',3:'位置情報の確認に時間がかかっています。再試行するか、店名で検索してください。'};
  setStatus(messages[error.code]||'周辺店舗を取得できませんでした。再試行するか、店名で検索してください。','error');
 }finally{
  if(request===geoRequest){geoController=null;resetGeoButtons();if($('resultPanel').classList.contains('hidden')&&$('candidatePanel').classList.contains('hidden')&&$('allPanel').classList.contains('hidden'))show($('quickPanel'));}
 }
}
function renderAllTable(){const target=$("storeList");target.innerHTML="";for(const store of STORE_DATA){const btn=document.createElement("button");btn.type="button";btn.className="bubble";const p=store.payments.filter(p=>p.rankable).sort(paymentOrder)[0]||{n:"支払方法",r:"確認中"};btn.innerHTML='<span>'+escapeHtml(store.store)+'</span><strong>'+escapeHtml(p.n)+'<br>'+escapeHtml(comparisonLabel(p)||'要確認')+'</strong>';btn.onclick=()=>renderPayment(store);target.appendChild(btn);}}
function openStoreList(){cancelGeo();hide($("resultPanel"));hide($("candidatePanel"));hide($("quickPanel"));document.body.classList.remove("has-result");$("manualSearch").value="";setStatus("");renderAllTable();show($("allPanel"));window.scrollTo({top:0,behavior:"auto"});}
function clearView(){cancelGeo();$("manualSearch").value="";hide($("candidatePanel"));hide($("resultPanel"));hide($("allPanel"));document.body.classList.remove("has-result");lastSelectedStore=null;setStatus("");renderQuick();show($("quickPanel"));window.scrollTo({top:0,behavior:"auto"});}
async function copyResult(){if(!lastSelectedStore){setStatus("コピーする結果がありません。先に店舗を選んでください。","error");return;}const text=[`店舗：${lastSelectedStore.store}`,`1位：${lastSelectedStore.first}`,`2位：${lastSelectedStore.second}`,`3位：${lastSelectedStore.third}`,`提示ポイント：${lastSelectedStore.points.map(p=>p.n+' '+p.r).join(' ／ ')||'なし／未確認'}`,`組み合わせ：${lastSelectedStore.combination}`,`還元条件：${lastSelectedStore.conditions.join(' ')}`,`備考：${lastSelectedStore.note}`].join("\n");try{await navigator.clipboard.writeText(text);setStatus("結果をコピーしました。","ok");}catch(err){setStatus("コピーに失敗しました。ブラウザの制限により使えない場合があります。","error");}}
const RECENT_KEY="payment-checker-recent-stores";
function recentStores(){try{const a=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');return Array.isArray(a)?a.filter(n=>typeof n==='string').slice(0,5):[];}catch(_){return[];}}
function rememberStore(name){try{localStorage.setItem(RECENT_KEY,JSON.stringify([name,...recentStores().filter(n=>n!==name)].slice(0,5)));}catch(_){}renderQuick();}
function renderQuick(){const names=Array.from(new Set([...recentStores(),"ベルク","Fit Care DEPOT","ファミリーマート","コーナン","オーケー"])).slice(0,5);const box=$("quickStores");box.innerHTML="";for(const name of names){const store=STORE_DATA.find(s=>s.store===name);if(!store)continue;const btn=document.createElement('button');btn.type='button';btn.className='bubble';btn.textContent=name;btn.onclick=()=>renderPayment(store);box.appendChild(btn);}}
function runManualSearch(submit=false){cancelGeo();const keyword=$("manualSearch").value.trim();hide($("resultPanel"));document.body.classList.remove("has-result");if(!keyword){hide($("candidatePanel"));hide($("allPanel"));setStatus("");show($("quickPanel"));return;}const results=searchManual(keyword),q=normalizeText(keyword);results.sort((a,b)=>Number(b.store.aliases.some(x=>normalizeText(x)===q))-Number(a.store.aliases.some(x=>normalizeText(x)===q)));if(submit&&(results.length===1||(results[0]&&results[0].store.aliases.some(x=>normalizeText(x)===q)))){renderPayment(results[0].store);return;}if(!results.length){hide($("candidatePanel"));hide($("allPanel"));show($("quickPanel"));setStatus("該当する店舗がありません。短い名前や別名でもお試しください。","error");return;}setStatus("");renderCandidates(results,"検索候補");}
function setupEvents(){$("geoBtn").onclick=handleGeoSearch;$("resultGeoBtn").onclick=handleGeoSearch;$("clearBtn").onclick=clearView;$("listModeBtn").onclick=openStoreList;$("manualSearch").addEventListener("input",()=>runManualSearch());$("searchForm").onsubmit=e=>{e.preventDefault();runManualSearch(true);};$("inputClearBtn").onclick=()=>{clearView();$("manualSearch").focus();};$("showAllBtn").onclick=openStoreList;$("hideAllBtn").onclick=clearView;}
setupEvents();renderQuick();setStatus("");window.PAYMENT_CHECKER_READY=true;window.PAYMENT_STORE_COUNT=STORE_DATA.length;
window.addEventListener('pagehide',cancelGeo);

} catch (error) { const e=document.getElementById("status");if(e){e.className="status error";e.textContent="起動できませんでした。再読み込みしてください。 "+error.message;}console.error(error); }
