# Importando as bibliotecas necessárias
from flask import Flask, request, jsonify
from flask_cors import CORS
import io
import os # Para acessar variáveis de ambiente

# --- NOVAS IMPORTAÇÕES ---
# Biblioteca do Google para a API do Gemini
import google.generativeai as genai
# Biblioteca para carregar variáveis de ambiente de um arquivo .env
from dotenv import load_dotenv

# Biblioteca para ler e extrair texto de arquivos PDF.
try:
    from PyPDF2 import PdfReader
except ImportError:
    print("PyPDF2 não está instalado. Por favor, execute 'pip install PyPDF2'")
    PdfReader = None

# --- 1. CONFIGURAÇÃO DA API DO GEMINI (NOVO) ---
# Carrega as variáveis do arquivo .env para o ambiente
load_dotenv()

# Pega a sua chave de API que você guardou no arquivo .env
api_key = os.getenv("GOOGLE_API_KEY")

# Verifica se a chave de API foi encontrada
if not api_key:
    # Se não encontrar, lança um erro. O backend não vai iniciar sem a chave.
    raise ValueError("A variável de ambiente GOOGLE_API_KEY não foi definida. Crie um arquivo .env e adicione sua chave.")

# Configura a biblioteca do Google com a sua chave
genai.configure(api_key=api_key)


# --- 2. FUNÇÃO DE CLASSIFICAÇÃO COM IA (NOVO) ---
def classify_with_gemini(text: str) -> str:
    """
    Envia o texto do e-mail para a API do Gemini e retorna a classificação.
    """
    # Escolhemos o modelo. 'gemini-1.5-flash-latest' é rápido e ótimo para essa tarefa.
    model = genai.GenerativeModel('gemini-2.5-pro')

    # Este é o "prompt", a instrução que damos para a IA.
    # É a parte mais importante para obter um bom resultado.
    prompt = f"""
    Analise o seguinte texto de um e-mail e classifique-o como "Importante" ou "Improdutivo".

    - "Importante": E-mails que requerem uma ação, resposta, ou contêm informações críticas e urgentes, como faturas, propostas de negócio, problemas técnicos, agendamento de reuniões importantes, senhas, etc.
    - "Improdutivo": E-mails que não necessitam de ação imediata, como newsletters, propagandas, notificações de redes sociais, felicitações (Feliz Natal, etc.), e-mails informativos gerais.

    A sua resposta deve ser APENAS uma das duas palavras a seguir: "Importante" ou "Improdutivo".

    Texto do e-mail para análise:
    ---
    {text}
    ---

    Classificação:
    """
    
    try:
        # Enviamos o prompt para o modelo
        response = model.generate_content(prompt)
        # Limpamos a resposta para garantir que temos apenas a palavra desejada
        classification = response.text.strip().replace(".", "")

        # Verificação de segurança: se o modelo responder algo inesperado, definimos um padrão.
        if classification not in ["Importante", "Improdutivo"]:
            print(f"Resposta inesperada do modelo: '{classification}'. Usando 'Improdutivo' como padrão.")
            return "Improdutivo"
            
        return classification
    except Exception as e:
        # Se ocorrer um erro na chamada da API, registramos no console e relançamos a exceção.
        print(f"Ocorreu um erro ao chamar a API do Gemini: {e}")
        raise e


app = Flask(__name__)
CORS(app)

@app.route('/classify', methods=['POST'])
def classify_email():
    """
    Recebe o texto do e-mail, chama a função do Gemini para classificar e retorna o resultado.
    """
    email_text = ""

    # Lógica de extração de texto
    if 'file' in request.files:
        file = request.files['file']
        if file.filename.endswith('.txt'):
            email_text = file.read().decode('utf-8')
            print(f"Texto extraído do arquivo TXT: '{email_text[:100]}...'")
        elif file.filename.endswith('.pdf'):
            if not PdfReader:
                return jsonify({'error': 'A biblioteca PyPDF2 é necessária para processar PDFs.'}), 500
            try:
                pdf_reader = PdfReader(io.BytesIO(file.read()))
                text_parts = [page.extract_text() for page in pdf_reader.pages]
                email_text = "\n".join(text_parts)
                print(f"Texto extraído do arquivo PDF: '{email_text[:100]}...'")
            except Exception as e:
                return jsonify({'error': f'Falha ao processar o arquivo PDF: {e}'}), 400
        else:
            return jsonify({'error': 'Formato de arquivo não suportado. Envie .txt ou .pdf.'}), 400
    elif 'text' in request.form:
        email_text = request.form['text']
        print(f"Texto recebido do formulário: '{email_text[:100]}...'")

    if not email_text.strip():
        return jsonify({'error': 'Nenhum texto ou arquivo válido foi enviado.'}), 400

    # --- LÓGICA DE CLASSIFICAÇÃO ---
    try:
        classification_result = classify_with_gemini(email_text)
        print(f"Resultado da classificação (Gemini): {classification_result}")
        # Retornamos o resultado da IA para o frontend
        return jsonify({'classification': classification_result})
    except Exception as e:
        # Se a API da IA falhar, enviamos uma mensagem de erro clara para o frontend.
        return jsonify({'error': f'Ocorreu uma falha no serviço de IA. Tente novamente mais tarde.'}), 503 # 503: Service Unavailable

# --- Execução do Servidor (sem alterações) ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

