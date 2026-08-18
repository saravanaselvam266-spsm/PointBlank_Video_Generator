from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

credential = DefaultAzureCredential()

token_provider = get_bearer_token_provider(
    credential,
    "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(
    azure_endpoint="https://systechinternalapp.cognitiveservices.azure.com/",
    azure_ad_token_provider=token_provider,
    api_version="2024-12-01-preview"
)

response = client.chat.completions.create(
    model="gpt-5.4",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hi, who are you?"}
    ]
)

print(response.choices[0].message.content)