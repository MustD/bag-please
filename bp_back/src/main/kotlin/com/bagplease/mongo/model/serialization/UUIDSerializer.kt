package com.bagplease.mongo.model.serialization

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import org.bson.BsonType
import org.bson.codecs.kotlinx.BsonDecoder
import java.util.*

@OptIn(ExperimentalSerializationApi::class)
object UUIDMongoSerializer : KSerializer<UUID> {
    override val descriptor = PrimitiveSerialDescriptor("UUID", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: UUID) {
        encoder.encodeString(value.toString())
    }

    override fun deserialize(decoder: Decoder): UUID {
        return when (decoder) {
            is BsonDecoder -> {
                val bsonValue = decoder.decodeBsonValue()
                when (bsonValue.bsonType) {
                    BsonType.STRING -> UUID.fromString(bsonValue.asString().value)
                    BsonType.BINARY -> bsonValue.asBinary().asUuid()
                    else -> throw SerializationException("Cannot deserialize UUID from BSON type ${bsonValue.bsonType}")
                }
            }
            else -> UUID.fromString(decoder.decodeString())
        }
    }
}
