var audioObject;
var MicrophoneInput = function MicrophoneInput(bufferSize) {
	if (window.hasOwnProperty('webkitAudioContext') && !window.hasOwnProperty('AudioContext')) {
		window.AudioContext = webkitAudioContext;
	}

	if (navigator.hasOwnProperty('webkitGetUserMedia') && !navigator.hasOwnProperty('getUserMedia')) {
		navigator.getUserMedia = webkitGetUserMedia;
		if (!AudioContext.prototype.hasOwnProperty('createScriptProcessor')) {
			AudioContext.prototype.createScriptProcessor = AudioContext.prototype.createJavaScriptNode;
		}
	}

  // Q: Cannot change sample rate in Firefox
	this.context = new AudioContext();

	this.synthesizer = {};
	this.synthesizer.out = this.context.createGain();

	audioObject = this;
	this.initializeMicrophoneSampling();
};

// Create my processor & bind events
async function CreateMyProcessor(ctx) {
  const myProcessor = new AudioWorkletNode(ctx, 'my-processor');
  // port: https://stackoverflow.com/questions/62702721/how-to-get-microphone-volume-using-audioworklet
  myProcessor.port.onmessage = ((event) => {
    const ms = millis();
    SoundDataCallbackMyAnalyzer(event.data.buffer, event.data.downsampled, event.data.fft_frames);
    if (event.data.fft_frames) {
      event.data.fft_frames.forEach((f) => {
        const real = new Float32Array(400);
        const imag = new Float32Array(400);
        for (let i=0; i<400; i++) {
          real[i] = f[i];
        }
        
        // fft.js
        transform(real, imag);

        let spec = [];
        for (let i=0; i<400; i++) {
          const re = real[i], im = imag[i];
          const mag = Math.sqrt(re*re + im*im);
          spec.push(mag);
        }
        temp0 = f
        g_fft_vis.AddOneEntry(spec);
        g_recorderviz.AddSpectrumIfRecording(spec.slice(0, 200), ms);
      });
    }
  });
  return myProcessor;
}

MicrophoneInput.prototype.initializeMicrophoneSampling = function() {
  var errorCallback = function errorCallback(err) {
    console.log("errorCallback");
  };

  try {
    navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.getUserMedia;
    var constraints = {
      video: false,
      audio: true
    };
    var successCallback = async function successCallback(mediaStream) {
      if (! (mediaStream instanceof MediaStream)) {
        console.log("is not MediaStream");
      } else {
        console.log("is MediaStream");
      }
      window.mediaStream = mediaStream;
      // document.getElementById('elvisSong').style.display = 'none';
      console.log(window.mediaStream)
      console.log(audioObject.context)

      // source is a node
      var source = audioObject.context.createMediaStreamSource(window.mediaStream);

      let m = await audioObject.context.audioWorklet.addModule('my-processor.js');
      let processor = await CreateMyProcessor(audioObject.context);

      source.connect(processor);
    };

    try {
      console.log('Asking for permission...');
      navigator.getUserMedia(constraints, successCallback, errorCallback);
    } catch (e) {
      var p = navigator.mediaDevices.getUserMedia(constraints);
      p.then(successCallback);
      p.catch(errorCallback);
    }
  } catch (e) {
    errorCallback();
  }
};

// Load model
async function LoadModel() {
  console.log("Loading model");
  const ms0 = millis();
  const model = await tf.loadLayersModel("model/model.json");
  const elapsed_ms = millis() - ms0;
  console.log("Model loading took " + elapsed_ms + " ms")
  return model;
}

class SlidingWindow {
  constructor() {
    this.events = [];
  }

  AddOneEvent(ms, weight=1) {
    this.events.push([ms, weight]);
  }

  GetCountAndTotalWeightAfter(ms) {
    const e = this.events;
    let w = 0, cnt = 0
    for (let i=e.length-1; i>=0; i--) {
      if (e[i][0] >= ms) {
        w += e[i][1];
        cnt ++;
      } else break;
    }
    return [cnt, w];
  }
  
  RemoveEventsBefore(ms) {
    const e = this.events;
    let e1 = [];
    e.forEach((t) => {
      if (t[0] >= ms) {
        e1.push(t);
      }
    })
    this.events = e1;
  }
}

function ScaleFFTDataPoint(x) {
  let ret = log(x + 1);
  if (ret < 0) ret = 0;
  return ret;
}

async function DoPrediction(ffts) {
  const N = ffts.length;
  let tb = tf.buffer([1, N, 200, 1]);
  for (let i=0; i<N; i++) {
    for (let j=0; j<200; j++) {
      tb.set(ScaleFFTDataPoint(ffts[i][j]), 0, i, j, 0)  // Floating point to int16
    }
  }
  temp1 = ffts
  return await g_model.predict(tb.toTensor());
}

const PINYIN_LIST = ['you2', 'yu2', 'yu3', 'zhou4', 'kong1', 'jian1', 'huan2', 'jing4', 'xian3', 'e4', 'yin1', 'ci3', 'fan3', 'hui2', 'cang1', 'dou1', 'zuo4', 'cheng2', 'mi4', 'feng1', 'shi4', 'shi3', 'yuan2', 'wan2', 'quan2', 'ge2', 'jue2', 'ta1', 'men5', 'ming2', 'que4', 'ti2', 'chu1', 'ji4', 'yao4', 'du3', 'zhu4', 'hong2', 'shui3', 'de5', 'kou3', 'you4', 'zhua1', 'hao3', 'fang2', 'yi4', 'bing4', 'bu4', 'neng2', 'rang4', 'mei2', 'you3', 'bei4', 'tun1', 'mo4', 'sheng1', 'ming4', 'wen1', 'duo2', 'qu4', 'de2', 'dao4', 'li3', 'gong1', 'pu3', 'hao4', 'wen2', 'yi1', 'duo1', 'nu4', 'fen4', 'tian2', 'ying1', 'pai1', 'an4', 'er2', 'qi3', 'chi4', 'dong4', 'pai4', 'bei1', 'bi3', 'wu2', 'chi3', 'zai4', 'yue4', 'qian2', 'shan1', 'xia4', 'gui4', 'zhou1', 'chuan1', 'wu4', 'yun4', 'cang2', 'zhe5', 'nong2', 'lie4', 'nuo2', 'xi4', 'wei4', 'chong1', 'zhi4', 'ye3', 'qi4', 'xi1', 'yang2', 'xian4', 'min2', 'guo2', 'lao2', 'mo2', 'qin1', 'wan4', 'chang3', 'kan4', 'si4', 'qian1', 'mu3', 'gan1', 'ju2', 'lin2', 'yan4', 'lv4', 'zhi1', 'yao2', 'ye4', 'xu2', 'zhang3', 'zan4', 'jiu3', 'ba1', 'er4', 'nian2', 'huang2', 'xian1', 'sheng5', 'yue1', 'wo3', 'zao3', 'jian4', 'tang2', 'hua4', 
'qia4', 'feng2', 'zhong1', 'yan2', 'jiu1', 'yuan4', 'qing4', 'ta3', 'xiong2', 'tuan2', 'wen4', 'yan3', 'shi2', 'guan1', 'bing1', 'hou4', 'yong4', 'hua2', 'gu3', 'zhan4', 'ben3', 'se4', 'lai2', 'mei3', 'zhi2', 'liu2', 'yong3', 'gang1', 'deng3', 'wei3', 'hu1', 'yu4', 'xing2', 'pin3', 'zhuan1', 'ying2', 'bao3', 'an1', 'zou4', 'sa3',
'tuo1', 'ji2', 'ru2', 'yun2', 'ban1', 'shu1', 'chang4', 'chun2', 'nan2', 'bin1', 'yi2', 'ge4', 'wu3', 'nv3', 'chu2', 'le5', 'chi2', 'pen2', 'yi3', 'wai4', 'tong2',
 'yang4', 'ke3', 'xiang3', 'sang1', 'na2', 'zheng1', 'ding4', 'hai2', 'bie2', 'huo2', 'wang4', 'yuan3', 'fang1', 'dai4', 'ling4', 'ren2', 'kuang2', 'xi3', 'fa1', 'jiu2', 'fu4', 'weng1', 'jin3', 'jie1', 'ren4', 'ou1', 'hai3', 'qu1', 'ji5', 'qin3', 'he2', 'mang2', 'dang4', 'han4', 'liang2', 'wang2', 'ling2', 'sheng3', 'suo3', 'dan1', 'cao2', 'zhen1', 'ben1', 'zou3', 'lian2', 'diao4', 'wang3', 'tiao2', 'you1', 'nei4', 'di4', 'mou3', 'zang4', 'meng3', 'wei2', 'er3', 'lao3', 'sai4', 'cai3', 'shuang1', 'xun2', 'liang3', 'fen1', 'lun2', 'gong4', 'jiao4', 'liang5', 'sheng4', 'wo4', 'shou3', 'zhe4', 'a1', 'gen1', 'ting2', 'zu2', 'tan2', 'bu2', 'suan4', 'hen3',
'tu1', 'ju4', 'le4', 'dui4', 'kua4', 'yin2', 'lun4', 'xin1', 'li4', 'chen2', 'fu1', 'kan1', 'hu4', 'zui4', 'bian1', 'bai3', 'jing3', 'zheng2', 'zheng3', 'guang1', 'bo1', 'sao3', 'miao2', 'pei4', 'ji1', 'guo4', 'xue2', 'zao4', 'zhong3', 'dian4', 'nao3', 'shu4', 'du2', 'xiu4', 'gan3', 'shuo1', 'dao3', 'qun2', 'zhong4', 'tui1', 'jin4', 'dao1', 'qiang1', 'ying3', 'bai2', 'ma2', 'fang3', 'fu2', 'ting1', 'san1', 'shi5', 'yuan1', 'hun2', 'na4', 'han3', 'tong4', 'guan4', 'ju1', 'nao4', 'chang2', 'shen1', 'ping2', 'chou2', 'ri4', 'jia5', 'xiang1', 'yang3', 'chan3', 'dun1', 'jun1', 'mu2', 'da2', 'jin1', 'gai1', 'piao4', 'zao1', 'fou3', 'di2', 'ni2', 'zheng4', 'fu3', 'xing4', 'mian3', 'gan4', 'gao3', 'she4', 'pi1', 'si1', 'kao3', 'tan4', 'chuang4', 'chuang3', 'jiang4', 'tong1', 'xun4', 'bu3', 'fan2', 'guang3', 'da4', 'shou4',
'geng4', 'dai1', 'ji3', 'tian1', 'zong3', 'zuan4', 'dian3', 'pao3', 'tou2', 'mu4', 'gun4', 'xi2', 'zhuang1', 'bao4', 'cha2', 'ze2', 'ma3', 'bang4', 'kuan3', 'gui1'
, 'cai2', 'jian3', 'liu4', 'ge5', 'lu4', 'dang1', 'hang2', 'hui4', 'qing3', 'qi1', 'jiang1', 'e2', 'jiao1', 'cun2', 'qi2', 'kai1', 'han2', 'biao1', 'kuai4', 'pai2', 
'rou2', 'mao2', 'qiu2', 'ju3', 'jie2', 'hun1', 'jia1', 'ke2', 'zhuan3', 'fei1', 'xie1', 'ke4', 'qing2', 'guai1', 'zhang1', 'zen3', 'nai4', 'qing1', 'cui4', 'liu3', 'nen4', 'zhui1', 'guan3', 'mai4', 'shen4', 'cuo4', 'jiu4', 'wan3', 'cong2', 'di1', 'gao1', 'jie3', 'ying4', 'ao4', 'zhu3', 'shao4', 'zu3', 'dong1', 'lou4', 'mian4', 'bo2', 'ai4', 'zhi3', 'zhao1', 'shou1', 'man4', 'wen3', 'jing1', 'sha1', 'zi3', 'xiao4', 'guo3', 'bi4', 'qie3', 'lai5', 'bian4', 'tong3', 'ba3', 'tou4', 'nu3', 'gou4', 'jiao3', 'mo3', 'hei1', 'sun3', 'zi4', 'ruo4', 'gu4', 'xie3', 'xiao3', 'ai1', 'pei2', 'meng2', 'zhao3', 'bang1', 'lei4', 'dan4', 'zhao2', 'chi1', 'bei3', 'shang1',
'tai2', 'deng4', 'chuan2', 'huo4', 'ru4', 'peng2', 'you5', 'xiang4', 'lian4', 'dei3', 'jiang3', 'zi5', 'ran2', 'bai5', 'die2', 'en1', 'ci4', 'li2', 'chou3', 'chao2'
, 'nong4', 'cai4', 'yan1', 'gua1', 'yang1', 'zuo3', 'hou2', 'zong1', 'xu4', 'fan1', 'chun1', 'dian2', 'gai3', 'fang4', 'zhuo2', 'zhuang4', 'ang2', 'kuo4', 'gang3', 'ku4', 'zeng1', 'shuai4', 'ling3', 'cuo1', 'biao3', 'huan1', 'ning3', 'su4', 'liao4', 'gai4', 'la4', 'sai1', 'duan4', 'tao2', 'tai4', 'peng4', 'rui4', 'fa3', 'shu2',
'ya2', 'hua1', 'diao1', 'xie4', 'ni3', 'meng4', 'ken3', 'cha1', 'chu4', 'zhen4', 'shen2', 'qu5', 'xin4', 'chui1', 'niu2', 'yao1', 'xu3', 'ou2', 'shou2', 'dun4', 'rou4', 'rao3', 'luan4', 'shui4', 'tu2', 'mou2', 'ban3', 'pian4', 'du4', 'cha4', 'liang4', 'shang4', 'wa5', 'wo2', 'me5', 'ban4', 'bai4', 'jia2', 'tong5', 'qiang3', 'bei2', 'cun1', 'ceng2', 'shi1', 'dang2', 'miao4', 'qu3', 'jie4', 'nin2', 'po1', 'te4', 'sou1', 'gu1', 'lu5', 'can1', 'zhun3', 'qie4', 'fan4', 'pan4', 'chu3', 'xi5', 'ben2', 'xu1', 'zha1', 'kuang4', 'na3', 'er5', 'fu5', 'long5', 'qia3', 'he1', 'cu4', 'wa1', 'zhai3', 'pan2', 'rao4', 'che1', 'luo2', 'xuan2', 'ding3', 'piao1', 'jiao2',
 'di3', 'tuan1', 'chang1', 'xian2', 'dang3', 'hao2', 'qiang2', 'reng2', 'heng2', 'gua4', 'gou1', 'po4', 'qie1', 'zhan3', 'shan4', 'zha2', 'kong4', 'bei5', 'lao1', 'qiu1', 'yin3', 'zhuo1', 'hai4', 'chong2', 'la1', 'gao4', 'chai1', 'long2', 'tou5', 'ya1', 'xing1', 'sui4', 'reng1', 'huai4', 'ma1', 'xiu1', 'kang1', 'lv3', 'que1', 'fei4', 'pi2', 'pang4', 'ba4', 'niang2', 'zhi5', 'pu4', 'ya4', 'nan4', 'ning2', 'gei3', 'wa2', 'pa4', 'ma5', 'ping1', 'pang1', 'leng3', 'run4', 'za2', 'xue3', 'luo4', 'piao5', 'yang5', 'sui2', 'tan3', 'shua1', 'bing3', 'chuo1', 'jing5', 'jia3', 'zhe3', 'shu3', 'hu3', 'shang5', 'huan4', 'liao2', 'kun4', 'bao1', 'ti3', 'zeng4', 'song4', 'ce4', 'da3', 'mei4', 'xue4', 'dou4', 'dai3', 'su1', 'tang4', 'ao2', 'tang1', 'ma4', 'wo1', 'nang5', 'song1', 'si3', 'san3', 'wang1', 'lia3', 'mao4', 'zi1', 'ye2', 'pian5', 'ou3', 'lang2', 'mian2', 'pin2', 'qiao2', 'huai2', 'zhao4', 'gu5', 're4', 'lve4', 'man2', 'zhong2', 'pian1', 'xie2', 'zha4', 'jin2', 'lan2', 'zhu2', 'chen4', 'zong4', 'guai4', 'tun2', 'shao3', 'sun1', 'zan2', 'sha2', 'xia2', 'la5', 'ge1', 'qiao3', 'ku3', 'shun4', 'ke1', 'wa3', 'geng1', 'lou2', 'mao1', 'jiong2', 'jiong3', 'ting3', 'pin4', 'xuan3', 'suo2', 'lei2', 'bing5', 'xuan4', 'jun4', 'bi1', 'suo1', 'chuang2', 'xiao1', 'kao2', 'ai2', 'cheng1', 'ye5', 'chan2', 'zou2', 'deng1', 'nai5', 'xun1', 'wei1', 'huo3', 'teng2', 'yin4', 'jia4', 'cong1', 'pei1', 'kao4', 'ru3', 'hui1', 'guo1', 'qiao4', 'qi5', 'tiao4', 'mi2', 'dong3', 'zan1', 'shao2', 'yao5', 'rong2', 'yi5', 'gong3', 'man3', 'fen5', 'juan3', 'nian3', 'nai3', 'kai3', 'hou5', 'nuan3', 'sen1', 'ha1', 'bin4', 'pu2', 'shuan1', 'zuo2', 'she2', 'juan4', 'fo2', 'nian4', 'zong2', 'ka3', 'yu5', 'tu3', 'lei3', 'shuo4', 'ka1', 'chou4', 'qia1', 'zai1', 'sui1', 'lian3', 'zui3', 'po2', 'die1', 'wang5', 'wu1', 'jian2', 'qiong2', 'hu2', 'shuai1', 'cao1', 'ne5', 'pao4', 'yao3', 'bang3', 'cuan4', 'zun1', 'tao5', 'gou3', 'du1', 'pi4', 'shao1', 'pin1', 'diu1', 'men2', 'quan1', 'beng4', 'mai3', 'chao1', 'ci2', 'gui3', 'a5', 'tou1', 'xiong1', 'tui4', 'bu5', 'tan1', 'sang4', 'wan1', 'cao3', 'zui2', 'huang1', 'pang2', 'xuan1', 'pi3', 'zhu1', 'he4', 'jiang2', 'shui2', 'shen5', 'bi2', 'nuo4', 'lu3', 'chou5', 'chuang1', 'lan4', 'nu2', 'zuo5', 'qin2', 'ne4', 'can2', 'sao1', 'tang3', 'kang4', 'kuang1', 'zang1', 'ya3', 'kui2', 'zuan1', 'cui1', 'nv2', 'mi3', 'chou1', 'kuan1', 'dian1', 'chong3', 'lv2', 'nai2', 'fen3', 'mai2', 'ku1', 'tao4', 'zhen3', 'pu1', 'lang3', 'lang4', 'hun4', 'zhang4', 'kui4', 'huang4', 'bo3', 'niu3', 'zhai2', 'kun3', 'za1', 'rong5', 'ca1', 'tuo2', 'ci1', 'juan1', 'luan2', 'feng4', 'pan1', 'xue1', 'shen3', 'ding1', 'shuai3', 'che4', 'suan1', 'mie4', 'san4', 'zhai4', 'mei5', 'pian2', 'nie4', 'miu4', 'pen1', 'tao3', 'she3', 'yun1', 'yun5', 'xing3', 'chuan4', 'che3', 'fa5', 'zhu5', 'hui3', 'lu2', 'cou4', 'nao5', 'min3', 'bao2', 'xiao2', 'gun2', 'gun3', 'shai4', 'tui3', 'bang2', 'ceng1', 'li5', 'ti1', 'chuai4', 'leng2', 'chui5', 'shang3', 'qian4', 'bo5', 'zhou3', 'yong1', 'ba2', 'zhan1', 'ren3', 'jing2', 'bian5', 'qie2', 'chao3', 'yong5', 'shuang3', 'lai4', 'chan4', 'biao2', 'sheng2', 'jie5', 'niang5', 'pa2', 'heng1', 'ren5', 'yong2', 'tie3', 'zhe2', 'fen2', 'tai5', 'wu5', 'xing5', 'tuo4', 'mo5', 'cu1', 'ling5', 'nve4', 'tao1', 'nie1', 'chan1', 'qian3', 'hen2', 'duan1', 'zhua3', 'niao3', 'liao3', 'sa4', 'lang1', 'kui1', 'xiang2', 'tiao3', 'su2', 'ni4', 'keng1', 'nang2', 'chuan3', 'sou5', 'hai5', 'gai2', 'fei2', 'pao1', 'qiao1', 'beng1', 'ran3', 'pa1', 'dai5', 'pa5', 'tuo3', 'rou5', 'shan3', 'pao2', 'zhuan4', 'kua3', 'qin5', 'kun1', 'kong3', 'gu2', 'shan2', 'duo3', 'leng4', 'lao4', 'dui1', 'fa2', 'ang4', 'huan3', 'lan3', 'duo4', 'gan5', 'si5', 'ben4', 'ruan3', 'kou4', 'ceng4', 'la3', 'ba5', 'qu2', 'mu5', 'tu4', 'shun5', 'si2', 'chai2', 'dan3', 'cheng5', 'weng5', 'tie1', 'zao2', 'gan2', 'guo5', 'hong1', 'xia1', 'ga1', 'wo5', 'can3', 'tie2', 'jun3', 'zhe1', 'pin5', 'pie3', 'pie2', 're3', 'seng1', 'rao2', 'quan4', 'fan5', 'mian5', 'duan3', 'deng2', 'su5', 'guan2', 'peng5', 'rang3', 'kan5', 'ang1', 'lang5', 'yue5', 'diao5', 'ning4', 'zha3', 'lie3', 'ruo5', 'ying5', 'guai3', 'liu1', 'shua3', 'cheng3', 'han1', 'hu5', 'lv5', 'tai1', 'huang3', 'heng5', 'wai1', 'kang2', 'dou3', 'ye1', 'du5', 'hen4', 'zhuan2', 'sang3', 'zhen2', 'zhang2', 'gua3', 'qia5', 'zei2', 'fei3', 'la2', 'po5', 'rui2', 'wa4', 'geng3', 'dao2', 'zai3', 'piao2', 'ta4', 'ya5', 'niao2', 'he5', 'jiu5', 'chuai1', 'ai3', 'cun4', 'chuo4', 'guang2', 'wan5', 'xiu3', 'zhui4', 'peng3', 'ti4', 'luan3', 'yun3', 'gui2', 'dao5', 'nuan2', 'lou3', 'gei2', 'xiong5', 'miao3', 'lia2', 'ken2', 'nei3', 'ka2', 'kong2', 'huo5', 'zhan2', 'qin4', 'tiao1', 'liao1', 'ju5', '_']
