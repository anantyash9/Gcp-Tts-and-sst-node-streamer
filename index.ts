/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as dotenv from 'dotenv';
import { speech } from './speech';
import * as socketIo from 'socket.io';
import * as path from 'path';
import * as http from 'http';
import * as express from 'express';
import * as cors from 'cors';
import * as sourceMapSupport from 'source-map-support';
import * as fs from 'fs';

const ss = require('socket.io-stream');

const speech1 = require('@google-cloud/speech');
const config = {
    encoding: "LINEAR16",
    sampleRateHertz: 16000,
    languageCode: 'en-US',
    speechContexts:[{'phrases': ['']}],
  };
  const request = {
    config,
    interimResults: true, //Get interim results from stream
  };
const speechClient = new speech1.SpeechClient();

dotenv.config();
sourceMapSupport.install();

export class App {
    public static readonly PORT:number = parseInt(process.env.PORT) || 8080;
    private app: express.Application;
    private server: http.Server;
    private io: SocketIO.Server;
    public socketClient: SocketIO.Server;
    public baseLang: string;
    
    constructor() {
        this.createApp();
        this.createServer();
        this.sockets();
        this.listen();

        this.baseLang = process.env.LANGUAGE_CODE;
    }
    private createApp(): void {
        this.app = express();
        this.app.use(cors({origin:'*'}));
        this.app.set('trust proxy', true);
  
        this.app.use(function(req: any, res: any, next: any) {
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

            if (req.secure) {
                // request was via https, so do no special handling
                console.log('secure connection dected')
                console.log(req)
                next();
            } else {
                if(req.headers.host != 'localhost:' + App.PORT && req.headers.host != process.env.EXTERNAL_IP){
                    // request was via http, so redirect to https
                    console.log(" redirecting to" + 'https://' + req.headers.host + req.url)
                    res.redirect('https://' + req.headers.host + req.url)
                } else {
                    console.log( "next called with url" ,'https://' + req.headers.host + req.url)
                    console.log(req)
                    next();
                }
            }

console.log()
        });
        this.app.use('/', express.static(path.join(__dirname, '../dist/public')));
        this.app.get('/test',(request,response)=>{response.send('server is working')})
    }

    private createServer(): void {
        this.server = http.createServer(this.app);
    }

    private sockets(): void {
        this.io = socketIo(this.server);

        this.io.origins('*:*');
    }

    private listen(): void {
        let me = this;
        this.server.listen(App.PORT, () => {
            console.log('Running server on port: %s', App.PORT);
        });

        this.io.on('connect', (client: any) => {
            var me = this;
            let recognizeStream: any = null;
            let temprequest=request;

            me.socketClient = client;
            console.log(`Client connected [id=${client.id}]`);
            client.emit('server_setup', `Server connected [id=${client.id}]`);
            client.on("tts",async function (data: any) {console.log("ttsdtat",data);
            speech.textToSpeech(data.text, data.audio.language).then(function(audio: AudioBuffer){
                me.socketClient.emit('audio', audio);
            }).catch(function(e: any) { console.log(e); })
        })
        client.on('startGoogleCloudStream', function (data:any) {
            console.log('STRMbeg');
             startRecognitionStream(client);
         });
         client.on('endGoogleCloudStream', function (data: any) {
            console.log('STRMend');
              stopRecognitionStream();
          });
          client.on('binaryData', function (data:any) {
            //console.log('data ' +data.length); //log binary data
           if (recognizeStream !== null) {
             //console.log('toSTRM')
               recognizeStream.write(data);
           }

       });
       client.on('setcontext', function (data:any) {
           console.log(data)
        temprequest.config.speechContexts=[{'phrases': data}]

   });
       function startRecognitionStream(client:any) {
        //    console.log(temprequest.config.speechContexts)
        recognizeStream = speechClient.streamingRecognize(temprequest)
            .on('error', console.error)
            .on('data', (data:any) => {
              /*  Dev only logging
                process.stdout.write(
                    (data.results[0] && data.results[0].alternatives[0])
                        ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
                        : `\n\nReached transcription time limit, press Ctrl+C\n`);
              */
                console.log(data.results[0].alternatives[0].transcript)
                client.emit('speechData', data.results[0]);
    
                // if end of utterance, let's restart stream
                // this is a small hack. After 65 seconds of silence, the stream will still throw an error for speech length limit
                if (data.results[0].isFinal) {
                    stopRecognitionStream();
                    startRecognitionStream(client);
                    console.log('restarted stream serverside');
                }
            });
    }
    
    function stopRecognitionStream() {
        if (recognizeStream) {
            recognizeStream.end();
        }
        recognizeStream = null;
    }

            // // simple DF detectIntent call
            // ss(client).on('stream-speech', async function (stream: any, data: any) {
            //     // get the file name
            //     // get the target language
            //     const targetLang = data.language;

            //     const speechContext=data.speechContext
            //     console.log("called")
            //     // stream.pipe(fs.createWriteStream(filename));
            //     // speech.speechStreamToText(stream, speechContext, async function(transcribeObj: any){
         
            //     //     // console.log(transcribeObj.words[0].speakerTag);
            //     //     // don't want to transcribe the tts output
            //     //     // if(transcribeObj.words[0].speakerTag > 1) return;
            //     //     console.log(transcribeObj.results[0].alternatives)
            //     //     me.socketClient.emit('transcript', transcribeObj.results[0].alternatives[0].transcript);

            //     //     // TTS the answer

            //     // });
            
            // });

        });
    }
}


export let app = new App();
