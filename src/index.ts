/**
 * Cloudflare Worker: Edge Network Identity
 */

interface Env {}

interface NetworkProfile {
  ip: string;
  provider: {
    isp: string;
    asn: number;
  };
  location: {
    city: string;
    region: string;
    country: string;
    postalCode: string;
    latitude: string;
    longitude: string;
    timezone: string;
  };
  connection: {
    datacenter: string;
    latencyMs: number;
    protocol: string;
    tlsVersion: string;
  };
  client: {
    userAgent: string;
    platform: string;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cf = request.cf;
    const headers = request.headers;
    
    const clientIp = headers.get('cf-connecting-ip') || headers.get('x-real-ip') || 'IP Desconhecido';

    if (!cf) {
      return new Response(JSON.stringify({ error: 'Contexto de rede indisponível' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const platformHeader = headers.get('sec-ch-ua-platform') || '';
    const cleanPlatform = platformHeader.replace(/"/g, '');

    // Composição direta: prioriza o QUIC, cai para TCP, e assume 0 se ambos falharem
    const tcpRtt = (cf.clientTcpRtt as number) || 0;
    const quicRtt = (cf.clientQuicRtt as number) || 0;
    const activeLatency = quicRtt > 0 ? quicRtt : tcpRtt;

    const profile: NetworkProfile = {
      ip: clientIp,
      provider: {
        isp: (cf.asOrganization as string) || 'Desconhecido',
        asn: (cf.asn as number) || 0,
      },
      location: {
        city: (cf.city as string) || 'Desconhecido',
        region: (cf.regionCode as string) || 'Desconhecido',
        country: (cf.country as string) || 'Desconhecido',
        postalCode: (cf.postalCode as string) || 'Desconhecido',
        latitude: (cf.latitude as string) || '0',
        longitude: (cf.longitude as string) || '0',
        timezone: (cf.timezone as string) || 'Desconhecido'
      },
      connection: {
        datacenter: (cf.colo as string) || 'Desconhecido',
        latencyMs: activeLatency,
        protocol: (cf.httpProtocol as string) || 'Desconhecido',
        tlsVersion: (cf.tlsVersion as string) || 'Desconhecido'
      },
      client: {
        userAgent: headers.get('user-agent') || 'Desconhecido',
        platform: cleanPlatform || 'Desconhecida'
      }
    };

    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      }
    });
  }
};