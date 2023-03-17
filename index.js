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
if (!process.env.prefix) process.exit(1);

Array.prototype.shuffle = (array = []) => {
	for (let i = array.length - 1; i > 0; i--) {
		let j = Math.floor(Math.random() * m--);
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
};

const {log: origLog} = console;
console.log = (...args) => {
	if (process.env.debug) {
		origLog(...args);
	}
};

class report {
	constructor(uid) {
		this.uid = uid;
		this.headers = {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36',
			Accept: '*/*',
			'Accept-Encoding': 'gzip, deflate',
			'Accept-Language': 'zh-CN,zh;q=0.9',
			'Cache-Control': 'no-cache',
			'Content-Type': 'application/json;charset=UTF-8',
			Host: 'xgfy.sit.edu.cn',
			Origin: 'http://xgfy.sit.edu.cn',
			Referer: 'http://xgfy.sit.edu.cn/h5/#/',
		};
	}
	// 加密相关
	generateMD5(str) {
		return crypto.createHash('md5').update(str).digest('hex');
	}
	generateToken(time) {
		const hashed = this.generateMD5(`${this.uid}${process.env.prefix}${time}`);
		return (hashed.substring(16) + hashed.substring(0, 16)).toUpperCase();
	}
	// 请求函数
	async commonRequest(url, body) {
		console.log(`[Request] ${url}`);
		for (let i = 1; i < 5; i++) {
			const response = await this._commonRequest(url, body);
			if (response) {
				console.log(`[Response] ${JSON.stringify(response)}`);
				return response;
			} else {
				console.log(`请求 ${url} 失败, 正在重试… ${i + 1}/5`);
			}
		}
		return false;
	}
	async _commonRequest(url, body) {
		const time = new Date().getTime().toString();
		const _headers = this.headers;
		_headers.decodes = this.generateToken(time);
		_headers.ts = time;
		const response = axios({
			method: 'post',
			url,
			data: body,
			headers: _headers,
			timeout: 3000,
		})
			.then((response) => response.data)
			.catch((err) => {
				console.log(`[${this.uid}] ${err}`);
				return false;
			})
			.then((data) => {
				if (data.code !== 0) {
					return false;
				}
				return data;
			});
		return response;
	}
	// 获取最近上报数据
	async getReport() {
		const url = 'http://xgfy.sit.edu.cn/report/report/getMyReport';
		const body = {
			usercode: this.uid,
			batchno: '',
		};
		const response = await this.commonRequest(url, body);
		if (!response?.data) {
			console.log(`[${this.uid}] getReport failed`);
			return false;
		}
		return resp.data[0];
	}
	// 获取deptno参数
	async getDeptno() {
		return this.commonRequest('http://xgfy.sit.edu.cn/report/report/selectByCode', {code: this.uid})
			.then((data) => {
				if (!data?.data) {
					return false;
				}
				return data.data.deptno;
			})
			.catch(() => {
				console.log(`[${this.uid}] getDeptno failed`);
				return false;
			});
	}
	// 构造请求体
	async getBody(reportData) {
		const deptno = await this.getDeptno();
		// 初始值
		const initbody = {
			usercode: this.uid,
			username: reportData.username,
			usertype: 2,
			deptno: deptno ? deptno : 0,
			cfsj: '请选择',
			mdd: '请选择',
			inschool: reportData['inschool'] === '' ? '0' : reportData['inschool'],
		};
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
			hsbg72: '1',
			sfhscy: '1',
			id: 0,
		};
		// 从上次上报中获取数据
		Object.keys(reportData).forEach((key) => {
			if (key in body && reportData[key]) {
				body[key] = reportData[key];
			}
		});
		return Object.assign(initbody, body);
	}
	// 上报主函数
	async report(body) {
		return this.commonRequest('http://xgfy.sit.edu.cn/report/report/todayReport', body).then((data) => data.data);
	}
}

const Main = async (uid) => {
	axios({url: 'https://api-sh.yunwuu.cn/ip'})
		.then((data) => data.data)
		.then((ip) => console.log(`[IP] ${ip}`))
		.catch(() => console.log('[IP] Unknown'));
	const r = new report(uid);
	console.log(`[${uid}] start`);
	const reportData = await r.getReport();
	if (!reportData) {
		return false;
	}
	const body = await r.getBody(reportData);
	if (!body) {
		return false;
	}
	const response = await r.report(body);
	if (!response) {
		return false;
	}
	return true;
};

const run = async () => {
	if (!fs.existsSync('./config.json')) {
		console.log('config.json not found');
		process.exit(1);
	}
	fs.readFile('./config.json', 'utf8', (err, data) => {
		if (err) throw err;
		const users = JSON.parse(data);
		if (!users.users) {
			origLog('Users not found');
			process.exit(1);
		}
		let uids = [];
		Object.keys(users['users']).forEach((key) => uids.push(key));
		uids.shuffle();
		origLog(uids);
		uids.forEach((uid) => Main(uid).then((res) => (res ? origLog(`[${uid}] success`) : origLog(`[${uid}] failed`))));
	});
};

schedule.scheduleJob('0 0 * * * *', () => {
	if (process.env.heartbeat) {
		axios({url: process.env.heartbeat})
			.then((data) => origLog(`[Heartbeat] ${data.data}`))
			.catch(() => origLog('[Heartbeat] Failed'));
	}
	const date = new Date();
	if (date.getHours() === 6) {
		origLog(`[Time ${date.getHours()}:00] run!`);
		run();
	} else {
		origLog(`[Time ${date.getHours()}:00] sleeping...`);
	}
});
