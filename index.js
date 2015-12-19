#! /usr/bin/env node
var StatsD = require('node-statsd')
var program = require('commander');
var proc = require('./lib/proc');

program.version(require('./package').version);

var viewer = program.command('run');
viewer.description('View logs in teal-time.');

viewer.option('-a, --host [HOST]', 'Bind to HOST address (default: 127.0.0.1)', '127.0.0.1');
viewer.option('-p, --port [PORT]', 'Use PORT (default: 5000)', 8125);
viewer.option('-n, --name [NAME]', 'Use name (default: hostname)', require('os').hostname().split('.').join('-'));
viewer.option('-N, --namespace [NAMESPACE]', 'Use name space (default: proc)', 'proc');
viewer.action(function(options) {
	var client = new StatsD({
		host : options.host,
		port : options.port
	});

	proc.statPoll(function(err, data) {

		Object.keys(data.memory).forEach(function(key) {
			client.increment(options.namespace + '.' + options.name + '.memory.' + key, data.memory[key]);
		});
		data.network.forEach(function(iface) {
			Object.keys(iface.rx).forEach(function(key) {
				client.increment(options.namespace + '.' + options.name + '.network.' + iface.device + '.rx.' + key, iface.rx[key]);
				client.increment(options.namespace + '.' + options.name + '.network.' + iface.device + '.tx.' + key, iface.tx[key]);
			});
		});
		data.diskstats.forEach(function(disk) {
			var device = disk.device;
			delete disk.device;
			Object.keys(disk).forEach(function(key) {
				client.increment(options.namespace + '.' + options.name + '.disk.' + device + '.' + key, disk[key]);
			});
		});
		Object.keys(data.cpu.all).forEach(function(key) {
			if (key == 'percent')
				client.increment(options.namespace + '.' + options.name + '.cpu.all.' + key, data.cpu.all[key]);
			else
				client.increment(options.namespace + '.' + options.name + '.cpu.all.' + key, data.cpu.all[key]);
		});
		data.cpu.cores.forEach(function(core, i) {
			Object.keys(core).forEach(function(key) {
				if (key == 'percent')
					client.increment(options.namespace + '.' + options.name + '.cpu.' + i + '.' + key, core[key]);
				else
					client.increment(options.namespace + '.' + options.name + '.cpu.' + i + '.' + key, core[key]);
			});
		});
	});
});

program.parse(process.argv);
