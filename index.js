/*
    SIT-Health-Report
    Author: Cocogoat
    Date: 2023/1/27
*/


import fs from 'fs';
import axios from 'axios';
import crypto from 'crypto';
import schedule from 'node-schedule';
import dotenv from 'dotenv';
dotenv.config();


if(!process.env.prefix) process.exit(1);


Array.prototype.shuffle = function() {
    var array = this;
    var m = array.length,
        t, i;
    while (m) {
        i = Math.floor(Math.random() * m--);
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }
    return array;
}


console.log_ = console.log
console.log = (msg) => {
    if(process.env.debug) {
        console.log_(msg);
    }
}


class report {
    constructor(uid) {
        this.uid = uid;
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36",
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Cache-Control": "no-cache",
            "DNT": "1",
            "Host": "xgfy.sit.edu.cn",
            "Origin": "http://xgfy.sit.edu.cn",
            "Pragma": "no-cache",
            "Referer": "http://xgfy.sit.edu.cn/h5/#/",
            "Content-Type": "application/json;charset=UTF-8"
        }
    }
    // 延时
    async delay(ms) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve();
            } ,Math.random() * ms);
        })
    }
    // 加密相关
    generateMD5(data) {
        return crypto.createHash('md5').update(data).digest('hex');
    }
    generateToken(data, t) {
        const prefix = process.env.prefix;
        const hashed = this.generateMD5(data + prefix + t);
        return (
            hashed.substring(16)
            +
            hashed.substring(0, 16)
        ).toUpperCase();
    }
    // 请求函数
    async commonRequest (url, body) {
        console.log(`[Request] ${url}`);
        let retry = 5;
        while(retry > 0) {
            const res = await this.commonRequest_(url, body);
            if(res) {
                console.log(`[Response] ${JSON.stringify(res)}`);
                return res;
            } else {
                console.log(`请求${url}失败, 正在重试... ${retry}`);
                retry--;
            }
        }
        return false;
    }
    async commonRequest_ (url, body) {
        const _headers = this.headers;
        const timeStr = new Date().getTime().toString();
        const token = this.generateToken(this.uid, timeStr);
        _headers.decodes = token;
        _headers.ts = timeStr;
        return axios({
            method: 'post',
            url: url,
            headers: this.headers,
            data: body,
            timeout: 3000
        })
        .then(res => {
            const _res = res.data;
            return _res;
        })
        .then(data => {
            if(data.code != 0) {
                return false;
            }
            return data;
        })
        .catch(err => {
            console.log(`[${this.uid}] ${err}`);
            return false;
        })
    }
    // 获取最近上报数据
    async getReport () {
        const url = 'http://xgfy.sit.edu.cn/report/report/getMyReport';
        const body = {
            usercode: this.uid,
            batchno: ''
        };
        const resp = await this.commonRequest(url, body);
        if(!resp || !resp.data) {
            console.log(`[${this.uid}] getReport failed`);
            return false;
        }
        return resp.data[0];
    }
    // 获取deptno参数
    async getDeptno() {
        return this.commonRequest(
            'http://xgfy.sit.edu.cn/report/report/selectByCode',
            { code: this.uid }
        )
        .then(data => {
            if(!data || !data.data) {
                return false;
            }
            return data.data.deptno;
        })
        .catch(err => {
            console.log(`[${this.uid}] getDeptno failed`);
            return false;
        })
    }
    // 获取 inschool (废弃)
    // async getInschool () {
    //     return 0;
    // }
    // 获取 password (预留)
    async getPwd () {
        return null;
    }
    // 构造请求体
    async getBody (reportData) {
        const deptno = await this.getDeptno();
        // const inschool = await this.getInschool();
        // 初始值
        const initbody = {
            usercode: this.uid,
            username: reportData.username,
            usertype: 2,
            deptno: deptno ? deptno : 0,
            cfsj: '请选择',
            mdd: '请选择',
            inschool: reportData["inschool"] == "" ? "0" : reportData["inschool"]
        }
        const body = {
            jiguan: 0,
            wendu: 0,
            ksfl: 0,
            mjjcqzhz: 0,
            qwhtjzgfxdq: 0,
            tzrqwhtjzgfxdq: 0,
            position: '上海市-市辖区-奉贤区',
            szdsfzgfxdq: 0,
            szdssfyzgfxdq: 0,
            szdjsyzgfxdq: 0,
            drwf: 0,
            sy: '',
            jtgj: 0,
            jtcc: '',
            remarks: '',
            currentsituation: 3,
            ssm: null, 
            xcm: '',
            hsjc: '',
            hsbg72: "1",
            sfhscy: "1",
            id: 0
        }
        // 从上次上报中获取数据
        Object.keys(reportData).forEach(function(key) {
            if(key in body && reportData[key]) {
                body[key] = reportData[key];
            }
        })
        return Object.assign(initbody, body);
    }
    // 上报主函数
    async report(body) {
        return this.commonRequest('http://xgfy.sit.edu.cn/report/report/todayReport',body).then(data => {
            return data;
        })
    }
}

const Main = async function (uid) {
    axios({
        url: 'https://api-sh.yunwuu.cn/ip'
    }).then(data => {
        return data.data;
    }).then(ip => {
        console.log(`[IP] ${ip}`);
    }).catch(err => {
        console.log('[IP] Unknown')
    })
    const r = new report(uid);
    console.log(`[${uid}] waiting...`);
    console.log(`[${uid}] start`);
    const reportData = await r.getReport();
    if(!reportData) {
        return false;
    }
    const body = await r.getBody(reportData);
    if(!body) {
        return false;
    }
    const resp = await r.report(body);
    if(!resp) {
        return false;
    }
    return true;
}

const run = async () => {
    if(!fs.existsSync('./config.json')) {
        console.log('config.json not found');
        process.exit(1);
    }

    fs.readFile('./config.json', 'utf8', function (err, data) {
        if (err) throw err;
        const _users = JSON.parse(data);
        if(!_users.users) {
            console.log_('Users not found');
            process.exit(1);
        }
        var uids = [];
        Object.keys(_users["users"]).forEach((key) => {
            uids.push(key);
        })
        uids.shuffle();
        console.log_(uids);
        uids.forEach(function(uid) {
            Main(uid).then(res => {
                if(res) {
                    console.log_(`[${uid}] success`);
                } else {
                    console.log_(`[${uid}] failed`);
                }
            })
        })
    })
}


const job = schedule.scheduleJob('0 0 * * * *', function() {
    if(process.env.heartbeat) {
        axios({
            url: process.env.heartbeat
        }).then(data => {
            console.log_(`[Heartbeat] ${data.data}`);
        }).catch(err => {
            console.log_('[Heartbeat] Failed')
        })
    }
    const t = new Date();
    if(t.getHours() == 6) {
        console.log_(`[Time ${t.getHours()}:00] run!`);
        run();
    } else {
        console.log_(`[Time ${t.getHours()}:00] sleeping...`);
    }
})