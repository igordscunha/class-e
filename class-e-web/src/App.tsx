import { useState, useCallback, type ChangeEvent } from 'react';

// --- COMPONENTES AUXILIARES (sem alterações) ---
// ... (ResultIcon e Spinner continuam os mesmos)

const ResultIcon = ({ classification }: { classification: string | null }) => {
  if (!classification) return null;

  const iconClasses = "h-6 w-6 mr-2";

  if (classification === 'Importante') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
};

const Spinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);


export default function App() {
  // --- STATE MANAGEMENT (com uma adição) ---
  const [emailText, setEmailText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null); // NOVO: Armazena o objeto do arquivo
  const [classification, setClassification] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- HANDLERS (ATUALIZADOS) ---
  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setEmailText(e.target.value);
    setFileName(null);
    setFile(null); // Limpa o arquivo se o usuário digitar
    setClassification(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setClassification(null);
    setError(null);
    
    const allowedTypes = ['text/plain', 'application/pdf'];
    if (allowedTypes.includes(selectedFile.type)) {
      setFile(selectedFile); // Armazena o objeto do arquivo
      setFileName(selectedFile.name);
      setEmailText(''); // Limpa o texto, pois o arquivo tem prioridade
      
      // Se for um .txt, podemos ler e mostrar o conteúdo (opcional)
      if (selectedFile.type === 'text/plain') {
          const reader = new FileReader();
          reader.onload = (event) => setEmailText(event.target?.result as string);
          reader.readAsText(selectedFile);
      }

    } else {
      setError('Formato de arquivo inválido. Por favor, envie .txt ou .pdf.');
      setFileName(null);
      setFile(null);
    }
    e.target.value = ''; // Permite re-upload do mesmo arquivo
  };

  /**
   * *** ATUALIZADO ***
   * Agora envia os dados como FormData para suportar arquivos.
   */
  const classifyEmailAPI = async (data: { text?: string; file?: File | null }): Promise<string> => {
    const backendUrl = 'http://localhost:5000/classify';
    
    // FormData é a forma padrão de enviar arquivos via HTTP.
    const formData = new FormData();
    
    // Adiciona o arquivo ou o texto ao FormData. O backend vai procurar por essas chaves.
    if (data.file) {
      formData.append('file', data.file);
    } else if (data.text) {
      formData.append('text', data.text);
    }

    const response = await fetch(backendUrl, {
      method: 'POST',
      // IMPORTANTE: Ao usar FormData, NÃO definimos o header 'Content-Type'.
      // O navegador faz isso automaticamente, incluindo o 'boundary' necessário.
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `Erro HTTP: ${response.status}` }));
      throw new Error(errorData.error || 'Ocorreu um erro desconhecido na API.');
    }

    const result = await response.json();
    return result.classification;
  };

  const handleSubmit = useCallback(async () => {
    if (!emailText.trim() && !file) {
      setError('Por favor, escreva ou carregue um arquivo.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setClassification(null);

    try {
      // Passamos o texto OU o arquivo para a função da API.
      const result = await classifyEmailAPI({ text: emailText, file: file });
      setClassification(result);
    } catch (apiError: any) {
      setError(apiError.message || 'Falha ao conectar com o serviço de classificação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [emailText, file]);
  
  // --- RENDER (sem alterações) ---
  const renderResult = () => {
    if (!classification) return null;
    const isImportant = classification === 'Importante';
    const bgColor = isImportant ? 'bg-red-100 border-red-500' : 'bg-green-100 border-green-500';
    const textColor = isImportant ? 'text-red-800' : 'text-green-800';
    return (
      <div className={`mt-6 p-4 border-l-4 rounded-r-lg shadow-md transition-all duration-500 ease-in-out transform animate-fade-in ${bgColor} ${textColor}`} role="alert">
        <div className="flex items-center">
          <ResultIcon classification={classification} />
          <p className="font-bold text-lg">Classificação: {classification}</p>
        </div>
        <p className="text-sm mt-1">{isImportant ? 'Este e-mail parece precisar de atenção humana urgente.' : 'Este e-mail parece ser de baixa prioridade.'}</p>
      </div>
    );
  };
  
  return (
    <div className="bg-gray-50 font-sans flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-8 transition-all">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Classificador de E-mails com IA</h1>
          <p className="text-gray-500 mt-2">Escreva o conteúdo de um e-mail ou carregue um arquivo para que a IA possa classificá-lo.</p>
        </header>
        <main>
          <div className="space-y-4">
            <textarea value={emailText} onChange={handleTextChange} placeholder="Cole ou digite o texto do seu e-mail aqui..." className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow duration-200 resize-none" aria-label="Campo de texto do e-mail" />
            <div className="flex items-center justify-center"><span className="text-gray-400 text-sm">OU</span></div>
            <label htmlFor="file-upload" className="w-full flex justify-center px-6 py-4 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                <p className="mt-1 text-sm text-gray-600"><span className="font-semibold text-indigo-600">Carregue um arquivo</span></p>
                <p className="text-xs text-gray-500">.txt ou .pdf</p>
                {fileName && <p className="text-xs text-green-600 mt-2 font-medium">Arquivo selecionado: {fileName}</p>}
              </div>
              <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".txt,.pdf" />
            </label>
          </div>
          <div className="mt-8">
            <button onClick={handleSubmit} disabled={isLoading} className="w-full flex items-center justify-center bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-all duration-300">
              {isLoading ? <><Spinner /> Classificando...</> : 'Classificar E-mail'}
            </button>
            {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
            {renderResult()}
          </div>
        </main>
      </div>
    </div>
  );
}

