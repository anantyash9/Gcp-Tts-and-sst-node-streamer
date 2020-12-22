import { isUndefined } from "util";


const speechToText = require('@google-cloud/speech').v1p1beta1;
const textToSpeech = require('@google-cloud/text-to-speech').v1beta1;

interface LooseObject {
    [key: string]: any
}

export class Speech {
    private encoding: string;
    private sampleRateHertz: Number;
    private ssmlGender: string;
    private tts: any;
    private stt: any;
    private ttsRequest: LooseObject;
    private sttRequest: LooseObject;
    private recognizeStream: any;
      
    constructor() {
        this.encoding = "LINEAR16";
        this.sampleRateHertz = 16000;
        this.ssmlGender = "MALE";
        this.setupSpeech();
    }

    setupSpeech(){
        this.tts = new textToSpeech.TextToSpeechClient();
        this.stt = new speechToText.SpeechClient();

        this.ttsRequest = {
          // Select the language and SSML Voice Gender (optional)
          voice: {
            ssmlGender: "FEMALE"  //  'MALE|FEMALE|NEUTRAL'
          },
          // Select the type of audio encoding
          audioConfig: {
            audioEncoding: "LINEAR16", //'LINEAR16|MP3|AUDIO_ENCODING_UNSPECIFIED/OGG_OPUS'
            
          },
          input: null
        };

        this.sttRequest = {

            config: {
              sampleRateHertz: this.sampleRateHertz,
              encoding: this.encoding,
              enableAutomaticPunctuation: false,
              // enableSpeakerDiarization: true,
              // diarizationSpeakerCount: 2,
              useEnhanced: false,
              languageCode:"en-IN",
              metadata: {
                microphoneDistance: 'NEARFIELD', //MIDFIELD
                interactionType: 'DICTATION',
                audioTopic: 'interview'
              }
            },

        };
        this.recognizeStream = this.stt
  .streamingRecognize(this.sttRequest )
  .on('error', console.error)
  .on('data', (data:any) =>{console.log(data.results[0].alternatives[0].transcript)}
    )
    }

    // async speechToText(audio: Buffer, lang: string) {
    //     this.sttRequest.config.languageCode = lang;
    //     this.sttRequest.audio = {
    //         content: audio,
    //     };

    //     const responses = await this.stt.recognize(this.sttRequest);
    //     const results = responses[0].results[0].alternatives[0];
    //     return {
    //         'transcript' : results.transcript,
    //         'detectLang': lang
    //     };
    // }

    async speechStreamToText(stream: any, speechContext: string, cb: Function) { 

      // // if( this.recognizeStream===undefined){
      // this.sttRequest.config.speechContexts=[{'phrases': speechContext}];
      // // console.log(this.sttRequest)

      // let recognizeStream = this.stt.streamingRecognize(this.sttRequest)
      // .on('data', function(data: any){
      //   console.log(data.results[0].alternatives)
      //   cb(data);
      // })
      // .on('error', (e: any) => {
      //   console.log(e);
      // })
      // .on('end', () => {
      //   console.log('on end');
      // });
    // }
    
      stream.pipe(this.recognizeStream);
      // stream.on('end', function() {
      //     //fileWriter.end();
      // });
    };

    async textToSpeech(text: string, lang: string) {
        this.ttsRequest.input = { text };
        this.ttsRequest.voice.languageCode = lang;
        this.setSpeechTweaks(lang);
        const responses = await this.tts.synthesizeSpeech(this.ttsRequest);
        return responses[0].audioContent;  
    }


    /*
     * The default synthesize settings, are not optimal for every language.
     * In certain languages, we tend to speak faster, or the pitch just sounds
     * a bit off.
     */
    setSpeechTweaks(lang: string){
      if(lang == 'nl-NL'){
        this.ttsRequest.audioConfig.pitch = -6;
        this.ttsRequest.audioConfig.speakingRate = 0.95;
      } else {
        this.ttsRequest.audioConfig.pitch = 0;
        this.ttsRequest.audioConfig.speakingRate =  0.95;      
      }
    }


}

export let speech = new Speech();