FROM debian:latest
RUN apt-get update && apt-get install -y dnsmasq docker.io
COPY update-dnsmasq.sh /usr/local/bin/update-dnsmasq.sh
RUN chmod +x /usr/local/bin/update-dnsmasq.sh
EXPOSE 53/udp
CMD ["/bin/bash", "-c", "/usr/local/bin/update-dnsmasq.sh && dnsmasq -k"]