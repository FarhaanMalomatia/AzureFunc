const { config: loadDotenv } = require('dotenv');
const { ChatOpenAI } = require('langchain/chat_models/openai');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { RedisVectorStore } = require('langchain/vectorstores/redis');
const { BufferWindowMemory } = require('langchain/memory');
const { RedisChatMessageHistory } = require('langchain/stores/message/ioredis');
const { RetrievalQAChain } = require('langchain/chains');
const { createClient } = require('redis');

loadDotenv();

function createRedisClient() {
    const client = createClient({
      url: process.env.REDIS_URL,
      pingInterval: 20,
      retryStrategy: function(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    client.connect();
    client.on('connect', function() {
      console.log('Connected to Redis');
    });
    client.on('error', function(err) {
      console.log('Redis error:', err);
    });
    client.on('end', function() {
      console.log('Redis connection closed. Attempting to reconnect...');
    });

    return client;
}

function factory() {
    const similaritySearchClient = createRedisClient();
    const embeddings = new OpenAIEmbeddings({
      azureOpenAIApiKey: process.env.OPENAI_API_KEY,
      azureOpenAIApiInstanceName: process.env.OPENAI_API_INSTANCE,
      azureOpenAIApiDeploymentName: "text-embedding-ada-002", 
      azureOpenAIApiVersion: "2022-12-01",
    });
    const messageHistory = new RedisChatMessageHistory({          
      sessionId: "my-session", 
      url: process.env.REDIS_URL,
    });
    const memory = new BufferWindowMemory({                     
      k: 5,
      memoryKey: "chat_history",
      chat_memory: messageHistory
    });
    const vectorStore = new RedisVectorStore(embeddings, {     
      redisClient: similaritySearchClient,
      indexName: "incident",
    });
    return {vectorStore, memory};
}

async function handleTurn(query) {
  console.log("Handling turn in OpenAI script.\n");
  console.log("Incoming query: ", query);

  const { vectorStore, memory } = factory();
  const recentData = await vectorStore.similaritySearch(query, 3);
  console.log(`RecentData :  ${recentData.map(doc => doc.pageContent).join('\n')} \n`);

  const responses = [];
  const llm = new ChatOpenAI({
      azureOpenAIApiKey: process.env.OPENAI_API_KEY, 
      azureOpenAIApiInstanceName: process.env.OPENAI_API_INSTANCE, 
      azureOpenAIApiDeploymentName: "gpt-35-turbo", 
      azureOpenAIApiVersion: process.env.OPENAI_API_VERSION, 
      temperature : 0.7 
  });

  const qa = RetrievalQAChain.fromLLM(llm, vectorStore.asRetriever(1), memory);

  let index = 0;
  for (const data of recentData) {
      const systemMessage = `You are MoEHE Helpdesk assistant.\nThe user asked this question \n question: '''${query}'''. \nRespond to this question by referring only to this Knowledge Base Information.\n  Information:\n"${data.pageContent}".\n\nIf the question is not directly related to the Knowledge Base information, say "I can't provide that information."\nRemember the response should be title of 5 words`;
      console.log(`System message for data ${index + 1}: \n\n`, systemMessage);
      const result = await qa.call({ "query": systemMessage });
      console.log(`Result from qa.call for data ${index + 1}: `, result.text);

      if (result.text) {
          let response = result.text.split("\n\n", 1)[0];
          response = response.replace(/"/g, '').replace(/```/g, '');
          response = response.replace('Bot: ', '').replace('System: ', '').replace('AI: ', '');
          responses.push(response);
          console.log("Responses array after data ", index + 1, ": \n\n", responses);
      } else {
          console.log(`No response generated for data ${index + 1}`);
      }
      index++;
  };

  return responses;
}

  async function handleSelectedChoice(query){
      console.log("Handling turn in OpenAI script.");
      console.log("Incoming query: ", query);

      const { vectorStore, memory } = factory();
      const recentData = await vectorStore.similaritySearch(query, 1);
      console.log(`RecentData :  ${recentData.map(doc => doc.pageContent).join('\n')} \n`);
    
      console.log("Concatinated Data    :", recentData);
      
      let response = '';
    
      if (recentData.length > 0) {
        const llm = new ChatOpenAI({
          azureOpenAIApiKey: process.env.OPENAI_API_KEY, 
          azureOpenAIApiInstanceName: process.env.OPENAI_API_INSTANCE, 
          azureOpenAIApiDeploymentName: "gpt-35-turbo", 
          azureOpenAIApiVersion: process.env.OPENAI_API_VERSION,
          maxTokens: 100,
          temperature: 0.4
        });
        const qa = RetrievalQAChain.fromLLM(llm, vectorStore.asRetriever(1), memory); 

        // const systemMessage = `You are an helpful assistant.\nThe user asked you to provide details of this topic\n   Topic: '''${query}'''. \nprovide an indetail explanation to the topic only by referring to this Knowledge Base Information.\n   Information: '''${recentData.map(doc => doc.pageContent).join('\n')}'''.\n\n Always start your response with "If the ".\nIf the topic is not directly related to the Knowledge Base Information, say "I cannot provide you that information".\n But never respond to anything except the Knowledge Base Information`;
        const systemMessage = `You are MoEHE Helpdesk assistant.\nThe user asked you to provide details of this topic\n   Topic: '''${query}'''. \nprovide an indetail explanation to the topic, start your response with "If you are" if you do not know the answer say "I cannot provide you that information". Remember the response should be of 4 sentences maximum`;

        console.log("System message: \n\n", systemMessage);  
        const result = await qa.call({ "query": systemMessage });
    
        if (result.text) {
          response = result.text.split("\n\n", 1)[0];
          response = response.replace(/"/g, '').replace(/```/g, '');
          response = response.replace('Bot: ', '').replace('System: ', '').replace('AI: ', '') 
        } else {
          console.error(`Error: ${result.text} is undefined`);
        }
      } else {
        response = "I do not know the answer.";
      }
      return response;
  }
module.exports = {
  handleTurn,
  handleSelectedChoice,
};