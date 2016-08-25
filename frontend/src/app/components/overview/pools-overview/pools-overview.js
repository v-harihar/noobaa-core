import Disposable from 'disposable';
import ko from 'knockout';
import numeral from 'numeral';
import template from './pools-overview.html';

class PoolsOverviewViewModel extends Disposable {
    constructor({poolCount, nodeCount}) {
        super();

        this.poolCountText = ko.pureComputed(() => {
            let count = ko.unwrap(poolCount);
            return `${numeral(count).format('0,0')} Capacity Resources`;
        });

        this.nodeCountText = ko.pureComputed(() => {
            let count = ko.unwrap(nodeCount);
            return `${numeral(count).format('0,0')} Node${count === 1 ? '' : 's'}`;
        });
    }
}

export default {
    viewModel: PoolsOverviewViewModel,
    template: template
};
