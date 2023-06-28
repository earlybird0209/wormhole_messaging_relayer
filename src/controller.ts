import { Next } from "../relayer";
;
import { StandardRelayerContext } from "../relayer/application-standard";
import { TokenTransfer, parseTokenTransferPayload } from "@certusone/wormhole-sdk";

export class ApiController {
  processFundsTransfer = async (ctx: StandardRelayerContext, next: Next) => {
    let seq = ctx.vaa!.sequence.toString();
    ctx.logger.info(`chain middleware - ${seq} - ${ctx.vaaBytes}`);

    //my code
    let parsed = parseTokenTransferPayload(ctx.vaa.payload)
    console.log(parsed);
    console.log(ctx.vaa);
    console.log({
      recipientAddress: parsed.to.toString('hex'),
      senderAddress: new TextDecoder().decode(parsed.tokenTransferPayload),
      tokenAddress: parsed.tokenAddress.toString('hex')
    });

    //my code end

    await ctx.kv.withKey(["counter"], async ({ counter }) => {
      ctx.logger.debug(`Original counter value ${counter}`);
      counter = (counter ? counter : 0) + 1;
      ctx.logger.debug(`Counter value after update ${counter}`);
      return {
        newKV: { counter },
        val: counter,
      };
    });
    await next();
  };
}
