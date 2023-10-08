.PHONY: all

all: src/tools/virt_to_phys

src/tools/virt_to_phys: src/tools/virt_to_phys.c
	gcc -O3 -o src/tools/virt_to_phys src/tools/virt_to_phys.c
	echo virt_to_phys must be executed as root to read physical-virtual memory mapping
	sudo chown root src/tools/virt_to_phys
	sudo chmod +s src/tools/virt_to_phys