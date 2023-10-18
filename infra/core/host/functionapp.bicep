@description('Name of the function app')
param name string

@description('Id of the function app hosting plan')
param appServicePlanId string

@description('Location of the function app')
param location string = resourceGroup().location

@description('Tags for the function app')
param tags object = {}

@description('Runtime of the function app')
param runtime string = 'python'

@description('Application Insights Instrumentation Key')
@secure()
param appInsightsInstrumentationKey string

@description('Application Insights Connection String')
@secure()
param appInsightsConnectionString string

@description('Azure Blob Storage Account Name')
param AZURE_STORAGE_ACCOUNT string

@description('Azure Blob Storage Account Upload Container Name')
param AZURE_STAGING_CONTAINER string

@description('Azure Blob Storage Account Output Container Name')
param AZURE_STORAGE_CONTAINER string

@description('Azure Blob Storage Account Log Container Name')
param blobStorageAccountLogContainerName string = 'function-logs'

@description('Azure Blob Storage Account Key')
@secure()
param blobStorageAccountKey string

//@description('Azure Blob Storage Account Connection String')
//@secure()
//param blobStorageAccountConnectionString string


@description('Form Recognizer Serive')
param AZURE_FORMRECOGNIZER_SERVICE string

@description('Form Recognizer API Key')
@secure()
param AZURE_FORMRECOGNIZER_KEY string

param AZURE_OPENAI_GPT_DEPLOYMENT string
param AZURE_OPENAI_CHATGPT_DEPLOYMENT string
param AZURE_OPENAI_CHATGPT_MODEL string
param AZURE_OPENAI_EMB_DEPLOYMENT string
param AZURE_OPENAI_SERVICE string
param AZURE_SEARCH_INDEX string
param AZURE_SEARCH_SERVICE string
param AZURE_SEARCH_SERVICE_KEY string
param KB_FIELDS_CONTENT string
param KB_FIELDS_CATEGORY string
param KB_FIELDS_SOURCEPAGE string



// Create function app resource
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: name
  location: location
  tags: tags
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned'
  } 
  properties: {
    reserved: true
    serverFarmId: appServicePlanId
    siteConfig: {
      http20Enabled: true
      linuxFxVersion: 'python|3.10'
      alwaysOn: true
      minTlsVersion: '1.2'    
      connectionStrings:[
        {
          name: 'BLOB_CONNECTION_STRING'
          connectionString: 'DefaultEndpointsProtocol=https;AccountName=${AZURE_STORAGE_ACCOUNT};EndpointSuffix=${environment().suffixes.storage};AccountKey=${blobStorageAccountKey}'
        }
      ]
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${AZURE_STORAGE_ACCOUNT};EndpointSuffix=${environment().suffixes.storage};AccountKey=${blobStorageAccountKey}'
        }
        {
          name: 'AzureWebJobsconn'
          value: 'DefaultEndpointsProtocol=https;AccountName=${AZURE_STORAGE_ACCOUNT};EndpointSuffix=${environment().suffixes.storage};AccountKey=${blobStorageAccountKey}'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: runtime
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~14'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsightsInstrumentationKey
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT'
          value: AZURE_STORAGE_ACCOUNT
        }
        {
          name: 'AZURE_STAGING_CONTAINER'
          value: AZURE_STAGING_CONTAINER
        }
        {
          name: 'AZURE_STORAGE_CONTAINER'
          value: AZURE_STORAGE_CONTAINER
        }
        {
          name: 'BLOB_STORAGE_ACCOUNT_LOG_CONTAINER_NAME'
          value: blobStorageAccountLogContainerName
        }
        {
          name: 'BLOB_STORAGE_ACCOUNT_KEY'
          value: blobStorageAccountKey
        }
        {
          name: 'AZURE_FORMRECOGNIZER_SERVICE'
          value: AZURE_FORMRECOGNIZER_SERVICE
        }
        {
          name: 'AZURE_FORMRECOGNIZER_KEY'
          value: AZURE_FORMRECOGNIZER_KEY
        }
        {
          name: 'AZURE_OPENAI_GPT_DEPLOYMENT'
          value: AZURE_OPENAI_GPT_DEPLOYMENT
        }     
        { name: 'AZURE_OPENAI_CHATGPT_DEPLOYMENT'
          value: AZURE_OPENAI_CHATGPT_DEPLOYMENT
        }
        {
          name: 'AZURE_OPENAI_CHATGPT_MODEL'
          value: AZURE_OPENAI_CHATGPT_MODEL

        }
        {
          name: 'AZURE_OPENAI_EMB_DEPLOYMENT'
          value: AZURE_OPENAI_EMB_DEPLOYMENT
        }
        {
          name: 'AZURE_OPENAI_SERVICE'
          value: AZURE_OPENAI_SERVICE
        }
        {
          name: 'AZURE_SEARCH_INDEX'
          value: AZURE_SEARCH_INDEX
        }
        {
          name: 'AZURE_SEARCH_SERVICE'
          value: AZURE_SEARCH_SERVICE
        }
        {
          name: 'AZURE_SEARCH_SERVICE_KEY'
          value: AZURE_SEARCH_SERVICE_KEY
        }
        {
          name: 'KB_FIELDS_CONTENT'
          value: KB_FIELDS_CONTENT
        }
        {
          name: 'KB_FIELDS_CATEGORY'
          value: KB_FIELDS_CATEGORY
        }
        {
          name: 'KB_FIELDS_SOURCEPAGE'
          value: KB_FIELDS_SOURCEPAGE
        }
        {
          name: 'AzureWebJobsFeatureFlags'
          value: 'EnableWorkerIndexing'
        }
        {
          name: 'BUILD_FLAGS'
          value: 'UseExpressBuild'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: '1'
        }
        {
          name: 'XDG_CACHE_HOME'
          value: '/tmp/.cache'
        }
        {
          name: 'WEBSITE_HTTPLOGGING_RETENTION_DAYS'
          value: '1'
        }
        {
          name: 'ENABLE_ORYX_BUILD'
          value: 'true'
        }
      ]
    }
  }
}

output name string = functionApp.name
output identityPrincipalId string = functionApp.identity.principalId
