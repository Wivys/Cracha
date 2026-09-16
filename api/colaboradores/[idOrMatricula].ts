import handler from '../colaboradores';

export default async function (req: any, res: any) {
  // Passa o idOrMatricula da rota dinâmica para a query
  if (req.query && !req.query.idOrMatricula && req.url) {
    const parts = req.url.split('?')[0].split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart !== 'colaboradores') {
      req.query.idOrMatricula = decodeURIComponent(lastPart);
    }
  }
  return handler(req, res);
}
