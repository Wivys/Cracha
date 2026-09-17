import QRCode from 'qrcode';

export interface QrJpgOptions {
  url: string;
  nome?: string;
  matricula?: string;
  cargo?: string;
  unidade?: string;
}

/**
 * Gera uma imagem oficial do QR Code VLI em formato JPG (JPEG) de alta resolução,
 * pronta para compartilhamento (WhatsApp, Telegram, etc.) ou download na galeria.
 */
export async function generateQrJpgFile(options: QrJpgOptions): Promise<{
  file: File;
  blob: Blob;
  dataUrl: string;
  fileName: string;
}> {
  const { url, nome, matricula, cargo, unidade } = options;

  // Dimensões do card de imagem JPG
  const width = 800;
  const height = nome ? 1040 : 800;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível obter o contexto 2D do Canvas.');
  }

  // 1. Fundo 100% branco sólido (essencial para formato JPG evitar fundo preto)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 2. Topo Oficial Azul Marinho VLI (#002B49)
  ctx.fillStyle = '#002B49';
  ctx.fillRect(0, 0, width, 140);

  // Faixa de destaque amarelo VLI (#FFB81C)
  ctx.fillStyle = '#FFB81C';
  ctx.fillRect(0, 140, width, 8);

  // Textos do Topo
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VLI • LOGÍSTICA INTEGRADA', width / 2, 55);

  ctx.fillStyle = '#FFB81C';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('QR CODE DE ACESSO & QUALIFICAÇÕES', width / 2, 100);

  // 3. Geração do QR Code em alta definição
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 520,
    margin: 2,
    color: {
      dark: '#002B49',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });

  // Carrega a imagem do QR Code
  const qrImage = new Image();
  qrImage.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = (err) => reject(err);
    qrImage.src = qrDataUrl;
  });

  // Moldura do QR Code com cantos ligeiramente destacados
  const qrX = (width - 520) / 2;
  const qrY = 175;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(qrX - 14, qrY - 14, 548, 548);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(qrX - 14, qrY - 14, 548, 548);

  // Desenha o QR Code
  ctx.drawImage(qrImage, qrX, qrY, 520, 520);

  // 4. Seção Inferior com Dados do Colaborador
  if (nome) {
    // Nome do Colaborador
    ctx.fillStyle = '#002B49';
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nome.toUpperCase(), width / 2, 770);

    // Matrícula em destaque
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const sub = `MATRÍCULA: ${matricula || '---'}${cargo ? `  •  ${cargo}` : ''}`;
    ctx.fillText(sub, width / 2, 815);

    if (unidade) {
      ctx.fillStyle = '#64748B';
      ctx.font = '500 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(unidade, width / 2, 852);
    }

    // Instrução de Escaneamento
    ctx.fillStyle = '#0284C7';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Aponte a câmera para consultar certificações e crachá digital', width / 2, 905);

    // Rodapé de segurança
    ctx.fillStyle = '#94A3B8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Autenticação Digital VLI  •  Documento Válido', width / 2, 945);

    // Faixa decorativa no fundo
    ctx.fillStyle = '#002B49';
    ctx.fillRect(0, height - 16, width, 16);
    ctx.fillStyle = '#FFB81C';
    ctx.fillRect(0, height - 16, width, 5);
  }

  // 5. Converte para formato JPG (image/jpeg) com 95% de qualidade
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Falha ao exportar canvas para formato JPG.'));
      },
      'image/jpeg',
      0.95
    );
  });

  const cleanMatricula = (matricula || 'cracha').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `QRCode_VLI_${cleanMatricula}.jpg`;
  const file = new File([blob], fileName, { type: 'image/jpeg' });
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

  return { file, blob, dataUrl, fileName };
}

/**
 * Compartilha o QR Code diretamente em formato de foto JPG através do navegador / celular
 */
export async function shareQrCodeAsJpg(options: QrJpgOptions): Promise<{
  success: boolean;
  sharedViaNative: boolean;
  downloaded: boolean;
}> {
  try {
    const { file, dataUrl, fileName } = await generateQrJpgFile(options);

    // Tenta compartilhamento nativo com arquivo JPG
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `QR Code VLI - ${options.nome || options.matricula || 'Crachá'}`,
          text: `Acesse o crachá digital e qualificações de ${options.nome || 'Colaborador VLI'}:`,
        });
        return { success: true, sharedViaNative: true, downloaded: false };
      } catch (shareErr: any) {
        // Se o usuário cancelou o menu de compartilhar
        if (shareErr.name === 'AbortError') {
          return { success: false, sharedViaNative: false, downloaded: false };
        }
      }
    }

    // Fallback: se não suportar envio de arquivo via navigator.share, faz download automático da imagem JPG
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // E copia o link para a área de transferência
    try {
      await navigator.clipboard.writeText(options.url);
    } catch {
      // Ignora erro de clipboard
    }

    return { success: true, sharedViaNative: false, downloaded: true };
  } catch (err) {
    console.error('Erro ao compartilhar QR Code em formato JPG:', err);
    return { success: false, sharedViaNative: false, downloaded: false };
  }
}

/**
 * Faz download direto da foto JPG do QR Code
 */
export async function downloadQrCodeAsJpg(options: QrJpgOptions): Promise<void> {
  const { dataUrl, fileName } = await generateQrJpgFile(options);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
