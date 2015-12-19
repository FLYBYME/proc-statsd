var fs = require('fs');
var async = require('async')

function readProcFile(filename, callback) {
	fs.readFile('/proc/' + filename, function(err, filedata) {
		if (err)
			return callback(err);

		return callback(null, filedata.toString().trim().split("\n"));
	});
}

function readKeyValue(input, sep) {
	if (!sep)
		sep = ":";

	input = input;

	var r = {};

	for (key in input ) {
		line = input[key].trim().split(sep);

		if (line.length != 2)
			continue;

		line[0] = line[0].trim();
		line[1] = line[1].trim();

		// Convert kB values to bytes
		if (line[1].slice(-3) == ' kB' || line[1].slice(-3) == ' KB')
			line[1] = parseInt(line[1].substr(0, line[1].length - 3)) * 1024;

		// Append To Response
		r[line[0].toLowerCase()] = line[1];
	}

	return r;
}

exports.netdev = function(callback) {
	readProcFile('net/dev', function(err, netdev) {
		if (err)
			return callback(err);

		netdev = netdev;

		// Remove Headers
		netdev.shift();
		netdev.shift();

		var r = [];

		for (dev in netdev ) {
			// Split Line by whitespace
			line = netdev[dev].trim().match(/\S+/g);

			// Append To Response
			r.push({
				device : line[0].substr(0, line[0].length - 1),
				rx : {
					bytes : parseInt(line[1]),
					packets : parseInt(line[2])
				},
				tx : {
					bytes : parseInt(line[9]),
					packets : parseInt(line[10])
				}
			});
		}

		return callback(null, r);
	});
};

exports.meminfo = function(callback) {
	readProcFile('meminfo', function(err, meminfo) {
		if (err)
			return callback(err);

		meminfo = readKeyValue(meminfo);

		return callback(null, meminfo);
	});
};
function assoc(fields, values) {
	var o = {};
	var a = 0;
	values.forEach(function(v, i) {
		if (fields.length <= i) {
			if (!o._)
				o._ = {};
			o._[i] = v;
		} else
			o[fields[i]] = v;
	});
	return o;
}

var diskRows = ["device_number", "device_number_minor", "device", "reads_completed", "reads_merged", "sectors_read", "ms_reading", "writes_completed", "writes_merged", "sectors_written", "ms_writing", "ios_pending", "ms_io", "ms_weighted_io"]
exports.diskstats = function(callback) {
	readProcFile('diskstats', function(err, diskstats) {
		if (err)
			return callback(err);

		var out = [];

		diskstats.forEach(function(l) {
			var non = true

			var data = l.trim().split(/\s+/).map(function(i, k) {
				if (isNaN(i)) {
					return i;
				}
				i = parseInt(i);
				if (k >= 3 && i !== 0) {
					non = false

				}

				return i
			});
			if (!non)
				out.push(assoc(diskRows, data));
		});
		callback(null, out);
	});
};

exports._stat = function(callback) {

	readProcFile('stat', function(err, lines) {
		if (err)
			return callback(err);
		var cpus = {
			all : {},
			cores : []
		};
		lines.forEach(function(line) {
			if (line.indexOf('cpu') != -1) {

				var cpu = {
					total : 0,
					idle : 0,
					active : 0
				};

				var core = line.split(' ').shift().match(/[0-9]+/gi);

				var cpuTimes = line.match(/[0-9]+/gi);

				cpu.total = 0;

				cpu.idle = parseInt(cpuTimes[3]) + parseInt(cpuTimes[4]);
				for (var i = 0; i < cpuTimes.length; i++) {
					cpu.total += parseInt(cpuTimes[i]);
				}
				cpu.active = cpu.total - cpu.idle;

				if (core) {
					cpus.cores[parseInt(core[0])] = cpu;
				} else {
					cpus.all = cpu;
				}
			}
		});
		callback(null, cpus)
	});
};

var calculateCPUPercentage = function(oldVals, newVals) {
	var totalDiff = newVals.total - oldVals.total;
	var activeDiff = newVals.active - oldVals.active;
	return Math.ceil((activeDiff / totalDiff) * 100);
};

exports.statPoll = function(callback) {

	var last = {
		cpu : null,
		memory : null,
		network : null,
		diskstats : null
	};
	var first = true;
	setInterval(function() {

		async.parallel([
		function(done) {
			exports.netdev(function(err, network) {
				if (last.network)
					network.forEach(function(dev, i) {
						dev.rx.rate = (dev.rx.bytes - last.network[i].rx.bytes);
						if (dev.rx.rate < 0) {
							dev.rx.rate = 0
						}
						dev.tx.rate = (dev.tx.bytes - last.network[i].tx.bytes);
						if (dev.tx.rate < 0) {
							dev.tx.rate = 0
						}
					});
				last.network = network;
				done()
			});
		},
		function(done) {
			exports.diskstats(function(err, diskstats) {
				last.diskstats = diskstats;
				done()
			});
		},
		function(done) {
			exports.meminfo(function(err, memory) {
				last.memory = memory;
				done()
			});
		},
		function(done) {
			exports._stat(function(err, cpus) {
				if (last.cpu) {
					cpus.all.percent = calculateCPUPercentage(last.cpu.all, cpus.all);
					last.cpu.cores.forEach(function(cpu, i) {
						cpus.cores[i].percent = calculateCPUPercentage(cpu, cpus.cores[i]);
					});
				}

				last.cpu = cpus;
				done()
			});
		}], function() {
			if (first) {
				first = false
				return;
			}
			callback(null, last)
		});

	}, 1000);

};
