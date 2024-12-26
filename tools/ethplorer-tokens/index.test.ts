import { expect } from 'jsr:@std/expect/expect';
import { definition, run } from './index.ts';

Deno.test('exists definition', async () => {
  expect(definition).toBeInstanceOf(Object);
});

Deno.test('return something', async () => {
  const result = await run(
    {},
    {
      address: '0xaecd92aec5bfbe2f5a02db2dee90733897360983',
    },
  );
  expect(result.ETH).toBeInstanceOf(Object);
});

// Example Response from a random address from ethscan (maybe update it with something more meaningful)
// console.log
// {
//   "data": {
//     "address": "0xaecd92aec5bfbe2f5a02db2dee90733897360983",
//     "ETH": {
//       "price": {
//         "rate": 3310.9583065569927,
//         "diff": -0.61,
//         "diff7d": -5.08,
//         "ts": 1722308460,
//         "marketCapUsd": 398070938297.502,
//         "availableSupply": 120228315.01960197,
//         "volume24h": 18509113946.888195,
//         "volDiff1": 82.66674840939854,
//         "volDiff7": 23.27143647121173,
//         "volDiff30": 20.758269139724177,
//         "diff30d": -2.704217819818126,
//         "tsAdded": 0
//       },
//       "balance": 7.6891919974085585,
//       "rawBalance": "7689191997408558447"
//     },
//     "tokens": [
//       {
//         "tokenInfo": {
//           "address": "0x9d65ff81a3c488d585bbfb0bfe3c7707c7917f54",
//           "decimals": "18",
//           "name": "SSV Network",
//           "owner": "0xb35096b074fdb9bbac63e3adae0bbde512b2e6b6",
//           "symbol": "SSV",
//           "totalSupply": "11576871000000000000000000",
//           "lastUpdated": 1722307687,
//           "issuancesCount": 13,
//           "price": {
//             "rate": 31.33471379135969,
//             "diff": -0.8,
//             "diff7d": -7.4,
//             "ts": 1722308280,
//             "marketCapUsd": 313347137.91359687,
//             "availableSupply": 10000000,
//             "volume24h": 20486293.72264016,
//             "volDiff1": -73.62819213640415,
//             "volDiff7": 76.08838084501332,
//             "volDiff30": 73.18772919968399,
//             "diff30d": -16.082157322841766,
//             "bid": 31.35,
//             "currency": "USD"
//           },
//           "holdersCount": 6539,
//           "website": "https://ssv.network",
//           "image": "/images/SSV9d65ff81a.png",
//           "description": "ssv.network is a decentralized staking infrastructure that enables the distributed operation of an Ethereum validator. This is achieved by splitting a validator key between four or more non trusting node instances (‘multi-operator node’). The nodes are collectively tasked with executing the validator's duties under a consensus mechanism. In simple terms, the protocol transforms a validator key into a multisig construct governed by a consensus layer.",
//           "ethTransfersCount": 0
//         },
//         "balance": 1.9061155e+21,
//         "rawBalance": "1906115500000000026891"
//       },
//       {
//         "tokenInfo": {
//           "address": "0xfc40ba56a4d5b6c9a69c527bbf4322c4483af3e1",
//           "decimals": "0",
//           "name": "(agbonus.fun)",
//           "symbol": "$ Visit https://agbonus.fun to receive reward.",
//           "totalSupply": "151799",
//           "issuancesCount": 0,
//           "lastUpdated": 1695837308,
//           "price": false,
//           "holdersCount": 8010,
//           "ethTransfersCount": 0
//         },
//         "balance": 9732,
//         "rawBalance": "9732"
//       },
//       {
//         "tokenInfo": {
//           "address": "0xdc09ef6ba2a135b350d3d05c409497485d8b0a00",
//           "decimals": "0",
//           "name": "$ ETHGiftX.com",
//           "owner": "0x20f939861476fd85fc7d57a29e4a89e033d47e73",
//           "symbol": "$ Visit ETHGiftX.com to claim",
//           "totalSupply": "0",
//           "issuancesCount": 0,
//           "lastUpdated": 1694539660,
//           "price": false,
//           "holdersCount": 112455,
//           "ethTransfersCount": 0
//         },
//         "balance": 6000,
//         "rawBalance": "6000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0xc6572019548dfeba782ba5a2093c836626c7789a",
//           "decimals": "18",
//           "name": "Node ETH",
//           "owner": "0x16f692525f3b8c8a96f8c945d365da958fb5735b",
//           "symbol": "nETH",
//           "totalSupply": "11999549761618496918839",
//           "issuancesCount": 115,
//           "lastUpdated": 1721037568,
//           "price": false,
//           "holdersCount": 46,
//           "ethTransfersCount": 0
//         },
//         "balance": 2553750811079,
//         "rawBalance": "2553750811079"
//       },
//       {
//         "tokenInfo": {
//           "address": "0x30d20208d987713f46dfd34ef128bb16c404d10f",
//           "decimals": "18",
//           "name": "Stader",
//           "symbol": "SD",
//           "totalSupply": "150000000000000000000000000",
//           "lastUpdated": 1722308081,
//           "issuancesCount": 1,
//           "price": {
//             "rate": 0.6618395096629529,
//             "diff": 27.37,
//             "diff7d": 4.59,
//             "ts": 1722308340,
//             "marketCapUsd": 26978639.38209505,
//             "availableSupply": 40763114,
//             "volume24h": 4282713.58756049,
//             "volDiff1": 343.63645802883383,
//             "volDiff7": 47.0324395924203,
//             "volDiff30": 56.72463216952565,
//             "diff30d": 4.638797272818039,
//             "bid": 0.614046,
//             "currency": "USD"
//           },
//           "holdersCount": 16762,
//           "website": "https://staderlabs.com",
//           "ethTransfersCount": 0
//         },
//         "balance": 5.488207163578033e+21,
//         "rawBalance": "5488207163578032887760"
//       },
//       {
//         "tokenInfo": {
//           "address": "0x2379757bfba1f3ed7bb2a5c6fdcc157c56ce4d96",
//           "decimals": "18",
//           "name": "ETH...",
//           "price": false,
//           "symbol": "ETH",
//           "totalSupply": "100000000000000000000000000",
//           "issuancesCount": 0,
//           "lastUpdated": 1691579085,
//           "holdersCount": 4030,
//           "ethTransfersCount": 0
//         },
//         "balance": 1000000000000000000,
//         "rawBalance": "1000000000000000000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0xc07d836c2615f78da2e1f2ae435bf5a9ed4e83c2",
//           "decimals": "18",
//           "lastUpdated": 1692053532,
//           "name": "$ usdcoin.finance",
//           "price": false,
//           "symbol": "Visit https://usdcoin.finance to claim rewards.",
//           "totalSupply": "104900000000000000000000000",
//           "issuancesCount": 0,
//           "holdersCount": 23359,
//           "ethTransfersCount": 0
//         },
//         "balance": 1.049e+21,
//         "rawBalance": "1049000000000000000000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0x4d649d810a34bcb3a90c0e284601f68b7d389c26",
//           "decimals": "18",
//           "lastUpdated": 1693188121,
//           "name": "$ usd-coin.org",
//           "price": false,
//           "symbol": "Visit https://usd-coin.org to claim rewards",
//           "totalSupply": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
//           "issuancesCount": 0,
//           "holdersCount": 19587,
//           "ethTransfersCount": 0
//         },
//         "balance": 3.99999e+21,
//         "rawBalance": "3999990000000000000000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0xfafe8a7c0a9b3807cc1df0deb0ba0b5a5fb7a872",
//           "decimals": "18",
//           "lastUpdated": 1693800173,
//           "name": "# usd-coin.net",
//           "price": false,
//           "symbol": "Visit https://usd-coin.net to claim rewards",
//           "totalSupply": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
//           "issuancesCount": 0,
//           "holdersCount": 19742,
//           "ethTransfersCount": 0
//         },
//         "balance": 3.99999e+21,
//         "rawBalance": "3999990000000000000000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0x57b9d10157f66d8c00a815b5e289a152dedbe7ed",
//           "decimals": "6",
//           "name": "环球股",
//           "symbol": "HQG",
//           "totalSupply": "10000000000000000",
//           "lastUpdated": 1722307710,
//           "issuancesCount": 0,
//           "price": false,
//           "holdersCount": 85140,
//           "ethTransfersCount": 0
//         },
//         "balance": 10000000,
//         "rawBalance": "10000000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0xd568cefa0e25bae6bed15898365c4ae376a259d7",
//           "decimals": "6",
//           "lastUpdated": 1695444669,
//           "name": "# apyeth.com",
//           "price": false,
//           "symbol": "Visit https://apyeth.com to claim rewards",
//           "totalSupply": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
//           "issuancesCount": 0,
//           "holdersCount": 19978,
//           "ethTransfersCount": 0
//         },
//         "balance": 1400000,
//         "rawBalance": "1400000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0xa3e4b28bcc63e549886d642b2bf77ebbdfaba91b",
//           "decimals": "6",
//           "lastUpdated": 1696718934,
//           "name": "# apy-eth.net",
//           "price": false,
//           "symbol": "Visit https://apy-eth.net to claim rewards",
//           "totalSupply": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
//           "issuancesCount": 0,
//           "holdersCount": 19986,
//           "ethTransfersCount": 0
//         },
//         "balance": 1400000,
//         "rawBalance": "1400000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0x372d6a1f5f129fa48ef28e5b27922767855effea",
//           "decimals": "6",
//           "lastUpdated": 1698023904,
//           "name": "# aeth.network",
//           "price": false,
//           "symbol": "Visit aeth.network to claim rewards",
//           "totalSupply": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
//           "issuancesCount": 0,
//           "holdersCount": 19980,
//           "ethTransfersCount": 0
//         },
//         "balance": 1400000,
//         "rawBalance": "1400000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0x376d51efe44968591a45747e39c1da377b72af42",
//           "decimals": "18",
//           "lastUpdated": 1698993614,
//           "name": "ΕΤH ...",
//           "price": false,
//           "symbol": "ΕΤ H  ",
//           "totalSupply": "10492000000000000000000",
//           "issuancesCount": 0,
//           "holdersCount": 2693,
//           "ethTransfersCount": 0
//         },
//         "balance": 9.9e+21,
//         "rawBalance": "9900000000000000000000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0x1dd79ee9b97cf5b21abdb3483c6ed74371124d01",
//           "decimals": "18",
//           "lastUpdated": 1699010354,
//           "name": "ΕΤH ...",
//           "price": false,
//           "symbol": "ETHꓸ",
//           "totalSupply": "10492000000000000000000",
//           "issuancesCount": 0,
//           "holdersCount": 2961,
//           "ethTransfersCount": 0
//         },
//         "balance": 9.9e+21,
//         "rawBalance": "9900000000000000000000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0x975a2b8454f96ce08ec029a0169dcd1056ff246d",
//           "decimals": "18",
//           "lastUpdated": 1699369154,
//           "name": "Ꭼꓔ Ⲏ",
//           "price": false,
//           "symbol": "Ꭼꓔ Ⲏ",
//           "totalSupply": "10492000000000000000000",
//           "issuancesCount": 0,
//           "holdersCount": 3302,
//           "ethTransfersCount": 0
//         },
//         "balance": 9.9e+21,
//         "rawBalance": "9900000000000000000000"
//       },
//       {
//         "tokenInfo": {
//           "address": "0x1d8911fe72cb117a36ab47f8b222edc6aa16920b",
//           "decimals": "6",
//           "lastUpdated": 1703306251,
//           "name": "# LiquidETH.org",
//           "price": false,
//           "symbol": "Visit LiquidETH.org to claim rewards",
//           "totalSupply": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
//           "issuancesCount": 0,
//           "holdersCount": 19985,
//           "ethTransfersCount": 0
//         },
//         "balance": 1700000,
//         "rawBalance": "1700000"
//       }
//     ]
//   }
// }
