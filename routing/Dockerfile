# Pull base image.
FROM nginx:latest

# Take care of Nginx configurations for frontend and backend redirections
COPY ./nginx.conf /etc/nginx/nginx.conf

ENTRYPOINT ["nginx","-g","daemon off;"]