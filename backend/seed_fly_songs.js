import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initializeDB } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure DB initialized
initializeDB();

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Artist normalization map
export const ARTIST_NORM_MAP = {
  'alifiru': 'Ali Firu',
  'anonimcyp': 'Anonim CYP',
  'anonimtr': 'Anonim',
  'anonim': 'Anonim',
  'aşık mahsuni': 'Aşık Mahsuni Şerif',
  'asik mahsuni': 'Aşık Mahsuni Şerif',
  'ahmet kaya': 'Ahmet Kaya',
  'barış akarsu': 'Barış Akarsu',
  'baris akarsu': 'Barış Akarsu',
  'coskun sabah': 'Coşkun Sabah',
  'coşkun sabah': 'Coşkun Sabah',
  'levent yüksel': 'Levent Yüksel',
  'levent yüksel': 'Levent Yüksel',
  'ersay under': 'Ersay Üner',
  'ersay üner': 'Ersay Üner',
  'evrencan gunduz': 'Evrencan Gündüz',
  'evrencangunduz': 'Evrencan Gündüz',
  'evrencan gündüz': 'Evrencan Gündüz',
  'feride hilal akin': 'Feride Hilal Akın',
  'feride hilal akın': 'Feride Hilal Akın',
  'ibrahim erkal': 'İbrahim Erkal',
  'i̇brahim erkal': 'İbrahim Erkal',
  'ibrahim tatlıses': 'İbrahim Tatlıses',
  'i̇brahim tatlıses': 'İbrahim Tatlıses',
  'ikilem': 'İkilem',
  'i̇kilem': 'İkilem',
  'ilhan irem': 'İlhan İrem',
  'i̇lhan i̇rem': 'İlhan İrem',
  'ilhan şeşen': 'İlhan Şeşen',
  'i̇lhan şeşen': 'İlhan Şeşen',
  'ilyas yalçıntaş': 'İlyas Yalçıntaş',
  'i̇lyas yalçıntaş': 'İlyas Yalçıntaş',
  'intizar': 'İntizar',
  'i̇ntizar': 'İntizar',
  'irem': 'İrem',
  'i̇rem': 'İrem',
  'irem derici': 'İrem Derici',
  'i̇rem derici': 'İrem Derici',
  'koray avci': 'Koray Avcı',
  'koray avcı': 'Koray Avcı',
  'hiraizerdüş': 'HiraiZerdüş',
  'hiraizerdüs': 'HiraiZerdüş',
  'müslüm': 'Müslüm Gürses',
  'muslum': 'Müslüm Gürses',
  'sertab erener': 'Sertab Erener',
  'yüzyüzeyken konuşuşuruz': 'Yüzyüzeyken Konuşuruz',
  'yuzyuzeyken konusuruz': 'Yüzyüzeyken Konuşuruz',
  'yuzyuzeyken konuslasuruz': 'Yüzyüzeyken Konuşuruz',
  'fecri ebcioglu': 'Fecri Ebcioğlu',
  'fecri ebcioğlu': 'Fecri Ebcioğlu',
  'koma se bıra': 'Koma Se Bıra',
  'koma se bira': 'Koma Se Bıra'
};

// Known release years lookup
export const SONG_YEARS = {
  // Batch 1
  'ervahı ezelde': 2013,
  'bebek': 1996,
  'koca yaşlı şişko dünya': 2014,
  'minnet eylemem': 2015,
  'beni vur': 1993,
  'dardayım': 1998,
  'doruklara sevdalandım': 1994,
  'hep sonradan': 2001,
  'kafama sıkar giderim': 1998,
  'kendine iyi bak v1': 1990,
  'kendine iyi bak v2': 1990,
  'korkarım': 1998,
  'kum gibi': 1994,
  'nerden bileceksiniz': 2001,
  'penceresiz kaldım anne': 1985,
  'yakamoz': 1996,
  'içimde ölen biri var': 1992,
  'şiire gazele - azeri': 1993,

  // Batch 2
  'bambaşka biri': 1979,
  'bir garip yolcuyum (yalan dünya)': 1972,
  'düşünme hiç': 1983,
  'haykıracak nefesim': 1979,
  'hoşgör sen': 1975,
  'kim ne derse desin aşk için': 1976,
  'kimler geldi kimler geçti': 1973,
  'sensiz yıllarda': 1970,
  'anlatamıyorum': 1995,
  'gül bahçesi': 2018,
  'yolcu': 1997,
  'ihtilal': 2021,
  'kurban olayım': 2021,
  'eylülde gel': 1977,
  'fabrika kızı': 1970,
  'seni sana sen': 2020,
  'dillirga': null,
  'feslikan': null,
  'köprüden geçemedim': null,
  'portakal atışalım': null,
  'zeytinden aşı mısın': null,
  'ah bir ataş ver': null,
  'arpa buğday daneler': null,
  'ayva çiçek açmış': null,
  'divane aşık gibi': null,
  'drama köprüsü': null,
  'eklemedir koca kocak': null,
  'eklemedir koca konak': null,
  'izmir marşı': 1923,
  'mağusa limanı': null,
  'çanakkale türküsü': 1915,
  'ne ağlarsın benim zülfü siyahım': 1983,
  'kalp kalbe karşı derler': 2007,
  'bağrı yanık dostlara': 1980,
  'hayriyem': 2014,
  'arsız gönül': 2010,
  'ben böyleyim': 2010,
  'beyoğlu': 2002,
  'dam üstüne çul serer': 1998,
  'herşey güzel olacak': 1998,
  'kafama göre': 2014,
  'serseri mayın': 2010,
  'yalan': 2004,
  'çilli bom': 1993,
  'allah sorar': 1998,
  'anlamazdın': 1975,
  'bağdat': 2016,
  'garibim': 1998,
  'gittiğin yağmurla gel': 1997,
  'ölünce sevemezsem seni': 1997,
  'büklüm büklüm': 1976,
  'ben varım': 1974,
  'ay inanmıyorum': 1994,
  'yalancı bahar': 2001,
  'çeşmi siyahım': 1968,
  'uzun ince bir yoldayım': 1958,

  // Batch 3
  'bu fasulya yedi buçuk lira': null,
  'yanayım yanayım': 2009,
  'bana kara diyen dilber': 2005,
  'sen ağlama': 2005,
  'yalnızlık benim eski sevgilim': 2000,
  'kır papatyası': 2015,
  'unutulur': 1982,
  'ringo ringo şişeler': 2019,
  'gel gör beni aşk neyledi': 2004,
  'gözlerin (yalancı yarim)': 2006,
  'alla beni pulla beni': 1983,
  'aynalı kemer': 1978,
  'dağlar dağlar': 1970,
  'domates biber patlıcan sf1': 1988,
  'domates biber patlıcan sf2': 1988,
  'gesi bağları': 1978,
  'gülpembe': 1981,
  'kara sevda': 1988,
  'kol düğmeleri': 1968,
  'zalım sultan': 1978,
  'efendim işitmedim': 2004,
  'saygımdan': 2013,
  'sev yeter': 1986,
  'yaralarını ben sarayım': 2022,
  'müebbet': 2014,
  'seni seviyorum': 1995,
  'sözlerimi geri alamam': 1996,
  'bebeğim': 1994,
  'benimle oynama': 1994,
  'sen sevda mısın': 2015,
  'benimle oynar mısın': 1974,
  'bu su hiç durmaz': 1990,
  'sensiz olmaz': 1994,
  'haydar haydar': 2013,
  'yalnızım ben': 2013,
  'gökyüzünü tutamam': 2021,
  'acıtır gibi severek': 2020,
  'ağlama ben ağlarım': 2019,
  'sar bu şehri': 2018,
  'toprak yağmura': 2019,
  'annem': 2000,
  'kırık kalpler durağı': 2009,
  'neden': 2002,
  'onlar yanlış biliyor': 1997,
  'söz vermiştin': 2002,
  'kül': 2020,
  'mutlu yıllar': 2010,
  'sen gel diyorsun (öf öf)': 2014,
  'yağmur': 2008,
  'bekle beni': 1982,
  'bu son olsun': 1969,
  'deniz üstü köpürür': 1974,
  'ıslak ıslak': 1992,
  'mavi liman': 1987,
  'namus belası': 1974,
  'raptiye rap rap': 1992,
  'resimdeki gözyaşları': 1968,
  'sen de başını alıp gitme': 1992,
  'tamirci çırağı': 1975,
  'imkansız aşk': 2006,
  'dön bana': 2006,
  'esmer': 2014,
  'hatıram olsun': 1989,
  'bilinmeyen saati uygulaması': 2010,
  'arnavut kaldırımı': 1994,
  'aşktan öte': 2004,
  'gümüş': 2000,
  'deniz koydum adını': 2017,
  'kalbimi kırıyorlar anne': 2020,
  'aldattın mı': 2019,
  'dilerim ki': 2021,
  'gitme': 2019,
  'yapma nolursun': 2017,
  'ahh': 2002,
  'aman aman': 2005,
  'bekle dedi gitti': 2002,
  'beni yak': 1999,
  'elleri ellerime': 2009,
  'kufi': 2024,
  'senden daha güzel': 2009,
  'sor bana pişman mıyım': 2009,
  'yanıbaşımdan': 2002,
  'yürek': 2002,
  'içerim ben bu akşam': 1999,
  'sevdan bir ateş': 1999,
  'çavbella': 1989,
  'terk edilmiş şehirler': 2021,
  'delibal': 2015,
  'afedersin': 1996,
  'ateşteyim': 1994,
  'dilberim': 1994,
  'hercai': 1995,
  'meyhaneci': 1996,

  // Batch 4
  'çingenem': 1999,
  'hatırla sevgili': 2019,
  'aldırma gönül': 1977,
  'güzel günler göreceğiz çocuklar': 1996,
  'hasretinle yandı gönlüm': 1990,
  'kuşlar': 1990,
  'delice bir sevda': 1995,
  'yaz aşkım': 1995,
  'hovarda': 1995,
  'ali cabbar': 2023,
  'beyaz skandalım': 2019,
  'can dostum': 2021,
  'devriliyorsam': 2019,
  'müzik kutusu': 2017,
  'nalan': 2019,
  'aşkı kıyamet': 2003,
  'neyleyim': 2003,
  'sensiz olmuyor': 2005,
  'yani': 2003,
  'belki bir gün özlersin': 2006,
  'hoşçakal': 2010,
  'soğuk odalar': 2012,
  'senden güzeli mi var': 2023,
  'hanımefendi': 2019,
  'elveda deme bana': 1996,
  'sayenizde': 1995,
  'anlatmalıymış meğer': 2000,
  'anma arkadaş': 1974,
  'arap saçı': 1976,
  'aşkımız bitecek': 1976,
  'estarabim': 1975,
  'fesuphanallah': 1974,
  'sevdiğin (doğarken dünyayı)': 1977,
  'yalnızlar rıhtımı': 1976,
  'çöpçüler': 1977,
  'ah bu hayat çekilmez': 1976,
  'işte öyle bir şey': 1976,
  'iki aşık': 2017,
  'unutma beni': 1974,
  'uzunlar': 2020,
  'benimle evlensen kısa': 2018,
  'felaket': 2019,
  'gel ya da git': 2014,
  'ben ölmeden önce': 1999,
  'suçum değil': 1999,
  'anı': 1992,
  'ellerim bomboş': 1992,
  'sonuna kadar': 1995,
  'üzülme': 1995,
  'bana sor': 1990,
  'ben de özledim': 1982,
  'bu şehir': 1988,
  'hatıran yeter': 1990,
  'sabahçı kahvesi': 1992,
  'aşkımı bir sır gibi (gündüzüm seninle)': 1980,
  'dilek taşı': 1978,
  'intihaşk': 2017,
  'alev alev': 2002,
  'mandalinalar': 2012,
  'gönül': 1993,
  'hayal edemezsin': 2014,
  'trenler': 2014,
  'yol': 2018,
  'yak gel': 2009,
  'meyhaneler sen': 2008,
  'aşk nerden nereye': 2010,
  'al aşkını sok': 1994,
  'istanbulda': 1992,
  'gündoğdu marşı': 1988,
  'uğurlama': 1991,
  'yerine sevemem': 1994,
  'üstüme basıp geçme yar': 1995,
  'birkaç beden önce': 2011,
  'aşk': 2019,
  'derdim': 2021,
  'mahşer': 2022,
  'sen i̇stanbulsun': 2014,
  'sen istanbulsun': 2014,
  'yüreğim': 2010,
  'çatı katı': 2014,
  'kalbime gömerim o zaman': 2006,
  'cesaretin var mı aşka': 1995,
  'sen evlisin': 1984,
  'bir telefon': 2004,
  'bir efsaneydi': 1989,
  'karam': 2000,
  'köylü güzeli': 1993,
  'duyanlara': 2015,
  'galata': 2014,
  'isyan': 2011,
  'içim paramparça': 2011,
  'olsun': 2011,
  'allı turnam': 1998,
  'ankara': 1993,
  'anlasana': 1996,
  'aşkın mapushane': 2000,
  'dağlar mı yollar mı': 2004,
  'dert olur': 1999,
  'dostum': 1996,
  'ela gözlüm': 1996,
  'elfida': 2006,
  'kaçış (uçak yaparım)': 1995,
  'sevdana gönül verdim': 2004,
  'sevenler ağlarmış': 2000,
  'yollarda': 1993,
  'çemberimde gül oya': 2004,
  'kırmızı': 2004,
  'mavi duvar': 1998,
  'gir kanıma': 1991,
  'kal benimle': 1995,
  'papatya': 2019,
  'sevme': 2001,
  'haydi söyle': 1994,
  'sarhoş': 1984,
  'bir sebebi var': 2020,
  'bu saatten sonra': 2021,
  'işte hayat': 1977,
  'konuşamıyorum': 1977,
  'ellerimde çiçekler': 2001,
  'incir': 2014,
  'içimdeki duman': 2015,
  'sadem': 2015,
  'istanbul sokakları': 2009,
  'hayalet sevgilim': 2006,
  'beklenen gemi': 2020,
  'seni buldum ya': 2021,
  'böyle sever': 2018,
  'yıldızların altında': 2000,
  'nayino': 2009,
  'bir aşk hikayesi': 1986,
  'esmer günler': 1988,
  'gözlerinin hapsindeyim': 1990,
  'yemin ettim': 1991,
  'ben seni sevdugumi': 2002,
  'gelevera deresi': 2004,
  'aklım karıştı': 2003,
  'ara beni lütfen': 2006,
  'aşk oyunu': 2007,
  'baş harfi ben': 2006,
  'doktor': 2009,
  'gençlik marşı': 2008,
  'güzeller içinden': 2001,
  'hiç bana sordun mu': 1996,
  'kandırdım': 1996,
  'kurşun adres sormaz ki': 1993,
  'tutamıyorum zamanı': 2001,
  'yaparım bilirsin': 1993,
  'haykırsam dünyaya': 1997,
  'kar beyaz': 1997,
  'beni aşka inandır': 2011,
  'böyle ayrılık olmaz': 2011,
  'hoşgeldin': 2015,
  'sevmekten kim usanır': 1993,
  'bir garip aşk bestesi': 1998,
  'endamın yeter': 2001,
  'gidiyorum': 1999,
  'kan ve gül': 2001,
  'çayır çimen geze geze': 2001,
  'karaağaç': 1995,
  'karaağac': 1995,
  'bu gece son': 1993,
  'kadınım': 1993,
  'medcezir': 1993,
  'ya sonra': 1995,
  'yokluğunda': 2013,
  'kalbimin tek sahibine': 2014,

  // Batch 5
  'tavla': 1995,
  'mey': 2016,
  'pembe mezarlık': 2011,
  'bir derdim var': 2004,
  'cambaz': 2004,
  'deli': 2008,
  'sultaniyegah': 2005,
  'yaz yaz yaz': 2003,
  'sevemedim kara gözlüm': 1996,
  'zor dostum zor': 1997,
  'a be kaynana': 2016,
  'ben özledim': 2008,
  'kasaba': 2008,
  'lüzumsuz savaş': 2012,
  'kalbim yaralı': 2002,
  'bu akşam ölürüm': 1999,
  'mihriban': 1998,
  'araba': 1996,
  'aşka yürek gerek': 2002,
  'beni ağlatma': 1994,
  'bize gidelim beyler': 1996,
  'iki tas çorba': 1996,
  'jest oldu': 1996,
  'sana ihtiyacım var': 1996,
  'ben yoruldum hayat': 2015,
  'affet': 2006,
  'hangimiz sevmedik': 1994,
  'geceler kara tren': 1994,
  'gidelim buralardan': 1996,
  'gitme kal bu şehirde': 1992,
  'sen gibi': 2004,
  'zor': 2001,
  'bahça duvarından aştım': 1970,
  'başıma gelenler': 1974,
  'caddelerde rüzgar': 1990,
  'kim arar seni': 1979,
  'son arzum': 1976,
  'parla': 2023,
  'ezo': 1996,
  'saydım': 2004,
  'üflediler söndüm': 2011,
  'seviyorum seni': 1995,
  'yaramızda kalsın': 2018,
  '14 bahar': 2018,
  'adaletsiz seçim': 2018,
  'duygularıma esir oluyorum': 2018,
  'kurşun': 2018,
  'akşam güneşi': 1975,
  'batsın bu dünya': 1975,
  'dil yarası': 1984,
  'damla damla': 2005,
  'çekirge': 2003,
  'bulutlara esir olduk': 2016,
  'vermem seni ellere': 2017,
  'sonsuz': 1997,
  'sensiz ben': 2013,
  'beni kendinden kurtar': 2020,
  'bak': 2007,
  'aşk bir mevsim': 2019,
  'beni al': 2006,
  'beni sen inandır': 2006,
  'bilir o beni': 2018,
  'dön bak dünyaya': 2012,
  'dünyadan uzak': 2020,
  'hele bi gel (kavak yelleri)': 2006,
  'yıldızlar': 2008,
  'aşkın bahardır': 2013,
  'macera dolu amerika': 1995,
  'güzel kadın': 2013,
  'nefes bile almadan': 2008,
  'sen hep benimsin': 2007,
  'aldatıldık': 1996,
  'sevdik sevdalandık': 1997,
  'zifiri': 2017,
  'yan': 2020,
  'gitme bu gece': 2019,
  'siyahın matemi': 2000,
  'kendime yalan söyledim': 2011,
  'ölürüm hasretinle': 2005,
  'şimdi hayat': 2011,
  'özledim': 1989,
  'yürüyorum dikenlerin üstünde': 1989,
  'bana yalan söylediler': 1974,
  'dansöz': 2006,
  'haber gelmiyor yardan': 2004,
  'karabiberim': 1994,
  'mesafe': 2006,
  'zor bela': 2015,
  'aldırma deli gönlüm': 1992,
  'bir damla gözlerimde': 2010,
  'koparılan çiçekler': 2010,
  'o ye': 1992,
  'yanarım': 1999,
  'belalım': 1989,
  'ben sende tutuklu kaldım': 1998,
  'firuze': 1982,
  'geçer geçer': 1984,
  'gülümse': 1991,
  'haydi gel benimle ol': 1984,
  'istanbul istanbul olalı': 2002,
  'kaçın kurası': 1996,
  'masum değiliz': 1993,
  'sarışın': 1988,
  'seni istiyorum': 1988,
  'seni kimler aldı': 1998,
  'unuttun mu beni': 2017,
  'vazgeçtim': 1991,
  'adam': 1995,
  'aşkın olayım': 2018,
  'dilber': 2024,
  'hayyam': 2020,
  'deniz gözlüm': 2001,
  'sen giderken': 2001,
  'buz': 2009,
  'hasret türküsü': 1995,
  'içinde aşk var': 2017,
  'yan benimle': 2016,
  'bilir mi': 2016,
  'nasıl seveceğim': 2015,
  'rica ederim': 2005,
  'affetmedim kendimi': 1998,
  'koy koy koy': 1972,
  'beni anlama': 1997,
  'beni çok sev': 2017,
  'biz nereye': 2003,
  'gül döktüm yollarına': 2001,
  'hepsi senin mi (oynama şıkıdım)': 1994,
  'inci tanem': 1997,
  'kış güneşi': 1994,
  'nasıl geçti habersiz': 1997,
  'unutmamalı': 1994,
  'şeytan azapta': 1994,
  'gemiler': 1998,
  'kupa kızı sinek valesi': 2003,
  'ne ekmek ne de su': 1996,
  'papatya': 1996,
  'renkli rüyalar oteli': 2006,
  'ruhun sarışın': 2001,
  'istanbulda sonbahar': 2001,
  'yine yazı bekleriz': 2010,
  'unutmak i̇stiyorum': 2020,
  'unutmak istiyorum': 2020,
  'ben ölürsem': 2010,
  'tiryakinim': 2000,
  'yine aylardan kasım': 2000,
  'kusura bakma': 2019,
  'bu benim öyküm': 2018,
  'aytenli kadın': 2018,
  'gamzeler': 2019,
  'mor yazma': 2008,
  'neler oluyor hayatta': 1976,
  'aleni aleni': 2015,
  'günaydın': 2004,
  'her şeyim sensin': 2007,
  'ki sen': 2009,
  'kim o sakalli adam': 2018,
  'aldanırım': 1998,
  'bir tanem': 1996,
  'cezayir menekşesi': 2001,
  'kumralım': 1996,
  'kör bıçak': 1998,
  'sebepsiz fırtına': 1998,
  'dostum dostum': 1995,
  'korku': 1997,
  'ruhum': 1997,
  'samistal yaylası': 2003,
  'olmasa mektubun': 1985,
  'sezenler olmuş': 1988,
  'yedikule': 1992,
  'deli mavi': 1995,
  'sokak lambası': 2015,
  'mavi türkü': 2018,
  'aşk durdukça': 2008,
  'belki üstümüzden bir kuş geçer': 2005,
  'döneceksin diye söz ver': 2005,
  'haydi gel içelim': 2008,
  'kafile': 2005,
  'dinle beni bi': 2018,
  'sen varsın diye': 2021,
  'delikanlım': 1994,
  'anason': 2011,
  'ah bu şarkıların gözü kör olsun': 1988,
  'bir yangının külünü': 1970,
  'duydum ki unutmuşsun': 1970,
  'elbet bir gün buluşacağız': 1970,
  'fikrimin i̇nce gülü': 1974,
  'fikrimin ince gülü': 1974,
  'kıyamam': 1997,
  'uslanmıyor bu': 2020,
  'duvar': 2004,
  'pervane': 2001,
  'güneş topla benim için': 1988,
  'karlı kayın ormanında': 1978,
  'yiğidim aslanım': 1980,
  'evlerinin önü boyalı direk': 2007,
  'oy beni vurun': 2018,
  'aç kapıyı gir i̇çeri': 1974,
  'aç kapıyı gir içeri': 1974,
  'gurbet': 1972,
  'elveda': 2005,
  'şeytan': 2005,
  'kayıp şehir': 2012,
  'olduramadım': 2007,
  'dağları deldim': 2002,
  'sen anla': 1999,
  'güneş sensiz doğacak': 2005,
  'son defa': 1996,
  'gözyaşlarım anlatır': 1997,
  'bu aşk fazla sana': 1996,
  'sigara': 2001,
  'sil baştan': 2001,
  'yağmurlar': 1996,

  // Batch 6 - Multi-Artist New Songs from C:\FLY
  'cennet': 2012,
  'ankaranın bağları': 2009,
  'ankaranin baglari': 2009,
  'elvan dalton': 2010,
  'erik dalı': 2017,
  'erik dali': 2017,
  'esmerin adı oya': 1989,
  'esmerin adi oya': 1989,
  'hayatı tespih yapmışım': 2013,
  'hayati tespih yapmisim': 2013,
  'ille de roman olsun': 2008,
  'kara çalı gibi': 1993,
  'kara cali gibi': 1993,
  'konyalım': 1968,
  'konyalim': 1968,
  'osman aga': 1974,
  'zühtü': 1976,
  'zuhtu': 1976,
  'susma': 1990,
  'serserim benim': 1990,
  'ayrılık azeri': 1957,
  'ayrilik azeri': 1957,
  'anlıyorsun değil mi': 1979,
  'anliyorsun degil mi': 1979,
  'rüyamda buluttum': 2021,
  'ruyamda buluttum': 2021,
  'gökyüzünde yalnız gezen yıldızlar': 1968,
  'gokyuzunde yalniz gezen yildizlar': 1968,
  'sarı gelin': 1977,
  'sari gelin': 1977,
  'sen benim şarkılarımsın': 2001,
  'sen benim sarkilarimsin': 2001,
  'altın yüzüğüm kırıldı (pes)': 1972,
  'altin yuzugum kirildi (pes)': 1972,
  'altın yüzüğüm kırıldı': 1972,
  'altin yuzugum kirildi': 1972,
  'kerkük zindanı': 1999,
  'kerkuk zindani': 1999,
  'sarhoş (her akşam votka rakı ve şarap)': 1967,
  'sarhos (her aksam votka raki ve sarap)': 1967,
  'sahte sevgililer': 1989,
  'her şey seninle güzel': 1982,
  'her sey seninle guzel': 1982,
  'merdo': 1982,
  'sen benden gittin gideli': 2001,
  'yaşamdan ölüme': 2001,
  'yasamdan olume': 2001,
  'çıkmaz sokaklar': 2012,
  'cikmaz sokaklar': 2012,
  'yüreğimden tut': 2008,
  'yuregimden tut': 2008,
  'düşler sokağı': 1997,
  'dusler sokagi': 1997,
  'eksik bir şey mi var': 2000,
  'eksik bir sey mi var': 2000,
  'farketmeden': 1995,
  'kurşuni renkler': 1988,
  'kursuni renkler': 1988,
  'herşey bitmedi bitemez': 1976,
  'hersey bitmedi bitemez': 1976,
  'hasretler ayrılıkla başlar': 1996,
  'hasretler ayrilikla baslar': 1996,
  'rüyalar': 1991,
  'ruyalar': 1991,
  'yaz gülü': 2022,
  'yaz gulu': 2022,
  'jingle bells': 1857,
  'jingle bells - en ve tr': 1857,
  'jingle bells (en ve tr)': 1857,
  'en ve tr': 1857,
  'göçmen kızı': 1998,
  'gocmen kizi': 1998,
  'ağlama değmez hayat': 1968,
  'aglama degmez hayat': 1968,
  'ayrılmam': 1990,
  'ayrilmam': 1990,
  'bir hadise var (mühürledim seni kalbime)': 1991,
  'bir hadise var (muhurledim seni kalbime)': 1991,
  'bir hadise var': 1991,
  'bir pazar kahvaltısı': 2014,
  'bir pazar kahvaltisi': 2014,
  'rüyalara sor': 2024,
  'ruyalara sor': 2024,
  'nilüfer': 2006,
  'nilufer': 2006,
  'itirazım var': 1981,
  'itirazim var': 1981,
  'i̇tirazım var': 1981,
  'elveda meyhaneci': 1972,
  'huysuz ve tatlı kadın (şarkılar seni söyler)': 1970,
  'huysuz ve tatli kadin (sarkilar seni soyler)': 1970,
  'huysuz ve tatlı kadın': 1970,
  'huysuz ve tatli kadin': 1970,
  'leylam (yazımı kışa çevirdin)': 1970,
  'leylam (yazimi kisa cevirdin)': 1970,
  'leylam': 1970,
  'neredesin sen': 1969,
  'mevsim bahar': 1996,
  'her yerde kar var': 1965,
  'aşk kitabı': 1982,
  'ask kitabi': 1982,
  'haram geceler': 1992,
  'dokunma': 1979,
  'kal benim için': 2001,
  'kal benim icin': 2001,
  'kal benim i̇çin': 2001,
  'vazgeç gönül': 1996,
  'vazgec gonul': 1996,
  'kara kedi': 2010,
  'rüya': 1999,
  'ruya': 1999,
  'şinanay (ada vapuru)': 1989,
  'sinanay (ada vapuru)': 1989,
  'şinanay': 1989,
  'sinanay': 1989,
  'adı bende saklı': 1998,
  'adi bende sakli': 1998,
  'zalim': 1995,
  'yalnızlık senfonisi': 2011,
  'yalnizlik senfonisi': 2011,
  'biliyorsun': 1980,
  'lale devri': 2005,
  'sevemez kimse seni': 1969,
  'muhbir': 2017,
  'şımarık': 1997,
  'simarik': 1997,
  'sevdim seni bir kere': 1977,
  'iki yabancı': 2000,
  'iki yabanci': 2000,
  'i̇ki yabancı': 2000,
  'birden geldin aklıma': 2016,
  'birden geldin aklima': 2016,
  'yine sevebilirim': 2017,
  'beni sana hapsettin': 1999,
  'hareket vakti': 1994,
  'muhtemel aşk': 2015,
  'muhtemel ask': 2015,
  'vursalar ölemem': 1998,
  'vursalar olemem': 1998,
  'şimdi uzaklardasın': 1952,
  'simdi uzaklardasin': 1952,
  'lan': 2024,
  'leylim ley': 1975
};

function slugify(text) {
  const trMap = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'I': 'i', 'İ': 'i', 'i': 'i',
    'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
  };
  return text
    .normalize('NFC')
    .split('')
    .map(char => trMap[char] || char)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function importFlySongs(sourceDir = 'C:\\FLY') {
  const seedFilesDir = path.join(__dirname, 'fly_seeds');
  if (!fs.existsSync(seedFilesDir)) {
    fs.mkdirSync(seedFilesDir, { recursive: true });
  }

  // Combine files from sourceDir (if exists) and seedFilesDir
  const fileSourceMap = new Map();

  if (fs.existsSync(seedFilesDir)) {
    for (const f of fs.readdirSync(seedFilesDir)) {
      if (/\.(jpg|jpeg|png)$/i.test(f)) {
        fileSourceMap.set(f, path.join(seedFilesDir, f));
      }
    }
  }

  if (fs.existsSync(sourceDir)) {
    for (const f of fs.readdirSync(sourceDir)) {
      if (/\.(jpg|jpeg|png)$/i.test(f)) {
        const srcPath = path.join(sourceDir, f);
        fileSourceMap.set(f, srcPath);
        // Backup to fly_seeds
        const targetSeed = path.join(seedFilesDir, f);
        if (!fs.existsSync(targetSeed)) {
          fs.copyFileSync(srcPath, targetSeed);
        }
      }
    }
  }

  const reports = [];
  const artistsProcessedMap = new Map(); // artistName -> 'Vardı' | 'Eklendi'
  const songsProcessedMap = new Map();   // songTitle -> { status, year, artists, chordPath }

  const checkArtistStmt = db.prepare('SELECT ArtistID, ArtistName FROM Artists WHERE TRIM(LOWER(ArtistName)) = TRIM(LOWER(?))');
  const insertArtistStmt = db.prepare('INSERT INTO Artists (ArtistName) VALUES (?)');

  const checkSongStmt = db.prepare('SELECT SongID, SongTitle, SongYear, ChordImagePath FROM Songs WHERE TRIM(LOWER(SongTitle)) = TRIM(LOWER(?))');
  const insertSongStmt = db.prepare(`
    INSERT INTO Songs (SongTitle, Duration, SongYear, Lyrics, AudioPath, OriginalKey, ChordImagePath, LanguageID, Notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateSongYearStmt = db.prepare('UPDATE Songs SET SongYear = ? WHERE SongID = ?');
  const updateSongChordStmt = db.prepare('UPDATE Songs SET ChordImagePath = ? WHERE SongID = ?');

  const checkSongArtistStmt = db.prepare('SELECT 1 FROM Song_Artists WHERE SongID = ? AND ArtistID = ?');
  const insertSongArtistStmt = db.prepare('INSERT OR IGNORE INTO Song_Artists (SongID, ArtistID) VALUES (?, ?)');

  for (const [filename, srcFilePath] of fileSourceMap.entries()) {
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext).normalize('NFC');

    const dashIndex = baseName.indexOf('-');
    if (dashIndex === -1) {
      reports.push({
        file: filename,
        artists: [],
        songTitle: baseName,
        songYear: null,
        songStatus: 'Atlandı (Tire bulunamadı)',
        chordPath: '-'
      });
      continue;
    }

    let rawArtistPart = baseName.substring(0, dashIndex).trim();
    let rawSongPart = baseName.substring(dashIndex + 1).trim();

    // Clean trailing underscores/commas/(FLY) in song titles
    rawSongPart = rawSongPart.replace(/\s*\(FLY\)\s*$/i, '').replace(/[_,]+$/, '').trim();

    // Special case for Jingle Bells
    let songTitle = rawSongPart;
    let rawArtistList = rawArtistPart.split(',').map(a => a.trim()).filter(Boolean);

    if (rawArtistPart.toLowerCase() === 'jingle bells' && rawSongPart.toLowerCase() === 'en ve tr') {
      rawArtistList = ['Anonim'];
      songTitle = 'Jingle Bells (EN ve TR)';
    }

    // Process and normalize artists
    const artistObjects = [];
    for (let aName of rawArtistList) {
      const aKey = aName.trim().toLocaleLowerCase('tr-TR');
      if (ARTIST_NORM_MAP[aKey]) {
        aName = ARTIST_NORM_MAP[aKey];
      }

      let artistRow = checkArtistStmt.get(aName);
      let aStatus = 'Vardı';
      let aId = null;

      if (!artistRow) {
        const info = insertArtistStmt.run(aName);
        aId = info.lastInsertRowid;
        aStatus = 'Eklendi';
      } else {
        aId = artistRow.ArtistID;
      }

      if (!artistsProcessedMap.has(aName) || artistsProcessedMap.get(aName) === 'Vardı') {
        artistsProcessedMap.set(aName, aStatus);
      }

      artistObjects.push({ id: aId, name: aName, status: aStatus });
    }

    // Prepare chord destination filename & copy
    const firstArtistSlug = slugify(artistObjects[0]?.name || 'various');
    const songSlug = slugify(songTitle);
    const destFileName = `chord_fly_${firstArtistSlug}_${songSlug}${ext.toLowerCase()}`;
    const destFilePath = path.join(uploadDir, destFileName);
    if (!fs.existsSync(destFilePath)) {
      fs.copyFileSync(srcFilePath, destFilePath);
    }
    const chordRelativePath = `/uploads/${destFileName}`;
    const chordImagePathValue = JSON.stringify([chordRelativePath]);

    // Song Year determination
    const normalizedTitleKey = songTitle.trim().toLocaleLowerCase('tr-TR');
    const songYear = SONG_YEARS[normalizedTitleKey] || SONG_YEARS[slugify(songTitle).replace(/_/g, ' ')] || null;

    // Check if Song exists
    const existingSong = checkSongStmt.get(songTitle);
    let songStatus = 'Eklendi';
    let songId = null;

    if (existingSong) {
      songStatus = 'Vardı';
      songId = existingSong.SongID;

      // If existing song missing year, update it
      if (!existingSong.SongYear && songYear) {
        updateSongYearStmt.run(songYear, songId);
      }

      // If existing song missing ChordImagePath, update it
      if (!existingSong.ChordImagePath || existingSong.ChordImagePath === '[]' || existingSong.ChordImagePath === '') {
        updateSongChordStmt.run(chordImagePathValue, songId);
      }

      // Link all artists
      for (const aObj of artistObjects) {
        insertSongArtistStmt.run(songId, aObj.id);
      }
    } else {
      const info = insertSongStmt.run(
        songTitle,
        '',
        songYear,
        null,
        null,
        null,
        chordImagePathValue,
        1, // Türkçe
        null
      );
      songId = info.lastInsertRowid;
      songStatus = 'Eklendi';

      // Link all artists
      for (const aObj of artistObjects) {
        insertSongArtistStmt.run(songId, aObj.id);
      }
    }

    songsProcessedMap.set(songTitle, {
      songId,
      status: songStatus,
      year: songYear,
      artists: artistObjects.map(a => a.name).join(', '),
      chordPath: chordRelativePath
    });

    reports.push({
      file: filename,
      artists: artistObjects,
      songTitle,
      songYear,
      songStatus,
      songId,
      chordPath: chordRelativePath
    });
  }

  return {
    reports,
    artistsReport: Array.from(artistsProcessedMap.entries()).map(([artistName, status]) => ({ artistName, status })),
    songsReport: Array.from(songsProcessedMap.entries()).map(([songTitle, data]) => ({ songTitle, ...data }))
  };
}

// Run if called directly
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  console.log("Starting C:\\FLY import...");
  const { reports, artistsReport, songsReport } = importFlySongs();
  
  console.log("\n=== ARTISTS SUMMARY REPORT ===");
  console.table(artistsReport.map(a => ({
    'Sanatçı': a.artistName,
    'Durum': a.status
  })));

  console.log("\n=== SONGS SUMMARY REPORT ===");
  console.table(songsReport.map(s => ({
    'Şarkı': s.songTitle,
    'Sanatçı(lar)': s.artists,
    'İlk Söylediği Yıl': s.year || '-',
    'Durum': s.status,
    'Akor Görseli': s.chordPath
  })));
}
