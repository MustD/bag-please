FROM gradle:9.6.1-jdk25 AS build
# Root-level Gradle files must come first: libs.versions.toml lives in gradle/ and
# settings.gradle.kts declares the multi-module structure that bp_back/build.gradle.kts depends on.
COPY --chown=gradle:gradle settings.gradle.kts build.gradle.kts gradle.properties /home/gradle/src/
COPY --chown=gradle:gradle gradle/ /home/gradle/src/gradle/
COPY --chown=gradle:gradle bp_back/ /home/gradle/src/bp_back/
WORKDIR /home/gradle/src
# bp_front is not in this build context and Gradle refuses to configure a subproject whose
# directory does not exist, so drop just that include. Do NOT rewrite the whole file: it also
# applies the ben-manes versions settings plugin that root build.gradle.kts compiles against.
RUN sed -i '/bp_front/d' settings.gradle.kts
RUN gradle :bp_back:installDist --no-daemon

FROM eclipse-temurin:25
EXPOSE 4000
# installDist lays out bin/ (start script) + lib/ (jars), so the runtime image needs no
# tar extraction and no version-dependent filename.
COPY --from=build /home/gradle/src/bp_back/build/install/bp_back/ /app/
ENTRYPOINT ["/app/bin/bp_back"]
