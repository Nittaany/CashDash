pipeline {
    agent any

    parameters {
        string(name: 'REPO_URL', defaultValue: 'https://github.com/Nittaany/CashDash.git', description: 'Git repository URL')
        string(name: 'GIT_BRANCH', defaultValue: 'v1', description: 'Branch to build')
        string(name: 'AWS_CREDENTIALS_ID', defaultValue: 'aws-credentials-id', description: 'Jenkins AWS credentials ID')
        string(name: 'S3_BUCKET', defaultValue: 'your-s3-bucket-name', description: 'S3 bucket for deployment')
        string(name: 'REGION', defaultValue: 'ap-south-1', description: 'AWS region')
        string(name: 'CLOUDFRONT_DIST_ID', defaultValue: 'your-cloudfront-dist-id', description: 'CloudFront distribution ID')
    }

    environment {
        NODE_ENV = 'production'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: "${params.GIT_BRANCH}", url: "${params.REPO_URL}"
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install --legacy-peer-deps'
            }
        }

        stage('Build') {
            steps {
                sh 'CI=false npm run build' // bypass ESLint warnings in CI
            }
        }

        stage('Deploy to S3') {
            steps {
                withAWS(credentials: "${params.AWS_CREDENTIALS_ID}", region: "${params.REGION}") {
                    sh """
                        # Sync build folder to S3 bucket (no ACL, bucket ownership enforced)
                        aws s3 sync build/ s3://${params.S3_BUCKET}/ --delete
                        
                        # Invalidate CloudFront cache
                        aws cloudfront create-invalidation --distribution-id ${params.CLOUDFRONT_DIST_ID} --paths "/*"
                    """
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline finished.'
        }
        success {
            echo 'Deployment succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}
