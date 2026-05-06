FROM gradle:9.5.0-jdk25 AS build
# Root-level Gradle files must come first: libs.versions.toml lives in gradle/ and
# settings.gradle.kts declares the multi-module structure that bp_back/build.gradle.kts depends on.
COPY --chown=gradle:gradle settings.gradle.kts build.gradle.kts gradle.properties /home/gradle/src/
COPY --chown=gradle:gradle gradle/ /home/gradle/src/gradle/
COPY --chown=gradle:gradle bp_back/ /home/gradle/src/bp_back/
WORKDIR /home/gradle/src
# bp_front is not in this build context, so rewrite settings to only include bp_back;
# Gradle refuses to configure a subproject whose directory does not exist.
RUN printf 'rootProject.name = "bag_please"\ninclude("bp_back")\n' > settings.gradle.kts
RUN gradle :bp_back:buildFatJar --no-daemon

FROM eclipse-temurin:25
EXPOSE 4000
RUN mkdir /app
COPY --from=build /home/gradle/src/bp_back/build/libs/*.jar /app/ktor-server.jar
ENTRYPOINT ["java","-jar","/app/ktor-server.jar"]