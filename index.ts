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
            me.socketClient = client;
            console.log(`Client connected [id=${client.id}]`);
            client.emit('server_setup', `Server connected [id=${client.id}]`);
            client.on("tts",async function (data: any) {console.log("ttsdtat",data);
            speech.textToSpeech(data.text, data.audio.language).then(function(audio: AudioBuffer){
                me.socketClient.emit('audio', audio);
            }).catch(function(e: any) { console.log(e); })
        })
            // simple DF detectIntent call
            ss(client).on('stream-speech', async function (stream: any, data: any) {
                // get the file name
                const filename = path.basename(data.name);
                // get the target language
                const targetLang = data.language;

                stream.pipe(fs.createWriteStream(filename));
                speech.speechStreamToText(stream, targetLang, async function(transcribeObj: any){
         
                    // console.log(transcribeObj.words[0].speakerTag);
                    // don't want to transcribe the tts output
                    // if(transcribeObj.words[0].speakerTag > 1) return;

                    me.socketClient.emit('transcript', transcribeObj.transcript);

                    // TTS the answer

                
                });
            
            });
        });
    }
}

export let app = new App();
