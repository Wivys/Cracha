export interface AdminUser {
  id: string;
  email: string;
  nome: string;
  role: 'admin' | 'supervisor';
  definitive?: boolean;
  registeredAt?: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  matricula: string;
  foto_url: string | null;
  cargo?: string;
  unidade?: string;
  genero?: 'M' | 'H';
  created_at?: string;
}

export interface Treinamento {
  id: string;
  funcionario_id: string;
  nome_curso: string;
  data_validade: string; // Data ISO YYYY-MM-DD
  status: 'valido' | 'vencido';
  carga_horaria?: string;
  // Campos vinculados à extração da Universidade VLI (Webtraining)
  origem?: 'manual' | 'universidade_vli';
  categoria?: string; // ex: 'Requisitos Legais', 'Ambientação'
  vencimento_treinamento?: string; // ex: '11/05/2031' ou 'Não aplicável'
  vencimento_aso?: string; // ex: '26/05/2027' ou 'Não aplicável'
  status_webtraining?: string; // ex: 'Liberado'
}

export type TrainingItem = Omit<Treinamento, 'funcionario_id'>;

export interface WebtrainingParsedCourse {
  nome_curso: string;
  categoria: string;
  vencimento_treinamento: string;
  vencimento_aso: string;
  status_webtraining: string;
  status: 'valido' | 'vencido';
  data_validade: string;
  origem: 'universidade_vli';
}

export interface WebtrainingParsedData {
  nome: string;
  matricula: string;
  cargo: string;
  cursos: WebtrainingParsedCourse[];
  totalCursos: number;
  fonte?: string;
}

export interface FuncionarioWithTreinamentos extends Funcionario {
  treinamentos: Treinamento[];
}

export type FilterStatus = 'todos' | 'vencidos' | 'a_vencer' | 'validos';

export interface CoursePreset {
  id: string;
  nome: string;
  norma: string;
  validadeMesesPadrao: number;
  descricao: string;
}

export const CURSOS_PREDEFINIDOS: CoursePreset[] = [
  { id: 'nr10', nome: 'NR-10 - Segurança em Instalações e Serviços em Eletricidade', norma: 'NR-10', validadeMesesPadrao: 24, descricao: 'Trabalhos com riscos elétricos em terminais e oficinas' },
  { id: 'nr11', nome: 'NR-11 - Transporte, Movimentação, Armazenagem e Manuseio de Materiais', norma: 'NR-11', validadeMesesPadrao: 12, descricao: 'Operação de empilhadeiras, pontes rolantes e guindastes' },
  { id: 'nr12', nome: 'NR-12 - Segurança no Trabalho em Máquinas e Equipamentos', norma: 'NR-12', validadeMesesPadrao: 24, descricao: 'Operação segura de maquinário ferroviário e portuário' },
  { id: 'nr20', nome: 'NR-20 - Segurança com Inflamáveis e Combustíveis', norma: 'NR-20', validadeMesesPadrao: 12, descricao: 'Abastecimento de locomotivas e granéis líquidos' },
  { id: 'nr33', nome: 'NR-33 - Segurança e Saúde em Espaços Confinados', norma: 'NR-33', validadeMesesPadrao: 12, descricao: 'Acesso seguro a silos, tanques e vagões fechados' },
  { id: 'nr35', nome: 'NR-35 - Trabalho em Altura', norma: 'NR-35', validadeMesesPadrao: 24, descricao: 'Inspeção de vagões, esteiras elevadas e silos' },
  { id: 'ofs', nome: 'OFS - Operação Ferroviária Segura VLI', norma: 'Regulamento VLI', validadeMesesPadrao: 12, descricao: 'Procedimentos operacionais de circulação de trens' },
  { id: 'direcao', nome: 'Direção Defensiva em Pátios e Terminais', norma: 'Regulamento VLI', validadeMesesPadrao: 24, descricao: 'Circulação de veículos em áreas operacionais de carga' },
  { id: 'primeiros_socorros', nome: 'Primeiros Socorros e Suporte Básico', norma: 'NR-07', validadeMesesPadrao: 12, descricao: 'Atendimento emergencial e evacuação em terminais' },
];
