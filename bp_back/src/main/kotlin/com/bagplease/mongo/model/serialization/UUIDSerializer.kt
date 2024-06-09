package com.bagplease.mongo.model.serialization

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import org.bson.codecs.kotlinx.BsonDecoder
import org.bson.codecs.kotlinx.BsonEncoder
import java.util.*

object UUIDMongoSerializer : KSerializer<UUID> {
    override val descriptor = PrimitiveSerialDescriptor("UUID", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: UUID) {
        when (encoder) {
            is BsonEncoder -> encoder.encodeString(value.toString())
            else -> encoder.encodeString(value.toString())
        }
    }

    override fun deserialize(decoder: Decoder): UUID {
        return when (decoder) {
            is BsonDecoder -> decoder.decodeBsonValue().asBinary().asUuid()
            else -> UUID.fromString(decoder.decodeString())
        }

    }
}