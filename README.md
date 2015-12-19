
# proc-statsd?

Proc stats to statsd

# How to install
```
 npm i -g proc-statsd --user "root"
 
 ```
Copy to /etc/init/proc-statsd.conf
Replace 127.0.0.1with your statsd host

 ```
start on local-filesystems and net-device-up IFACE!=lo
stop on runlevel [!12345]

limit nofile 65536 65536

respawn
respawn limit 15 5

script
 proc-statsd run  --host 127.0.0.1  --port 8125
end script
 ```


# How to run
```
proc-statsd run 127.0.0.1//statsd host ip
```