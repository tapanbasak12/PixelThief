# Based on: https://raw.githubusercontent.com/cgvwzq/evsets/master/browser/verify_addr.sh
# Originally licnesed under: Apache 2.0 License (Full license found in APACHE_LICENSE file)
base=""
offset=0

pids=$(ps aux | grep -P 'd8|chrome' | awk '{print $2}')
for p in $pids; do
    bases=$(pmap $p | grep '131072K' | awk '{print $1}')
    if [ ! -z "$bases" ]; then
        pid=$p
        offset=0
        break;
    fi
done

pids=$(ps aux | grep -P 'firefox' | awk '{print $2}')
for p in $pids; do
    bases=$(pmap $p | grep '131076K' | awk '{print $1}')
    if [ ! -z "$bases" ]; then
        pid=$p
        offset=4096
        break;
    fi
done

# find right allocated buffer if no gc yet
for c in $bases; do
    base="0x$c"
    break;
done
if [ -z "$base" ]; then
    exit 1
fi

vaddrs=$(for address in $@; do printf '%x ' $(($base+$address+$offset)); done)
$(dirname $0)/virt_to_phys $pid $vaddrs