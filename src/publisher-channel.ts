import * as amqp from 'amqplib';

export class PublisherChannel {
  channel: amqp.Channel;

  async createChannel() {
    const connection = await amqp.connect(
      `amqps://fptcapra:${process.env.AMQPPASS}@seal.lmq.cloudamqp.com/fptcapra`
    );
    this.channel = await connection.createChannel();
  }

  async sendEvent(msg: string) {
    if (!this.channel) {
      await this.createChannel();
    }
    const exchange = 'refund_exchange';
    await this.channel.assertExchange(exchange, 'fanout', { durable: false });
    await this.channel.publish(exchange, '', Buffer.from(msg));
  }
}
